import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import IssueList from './IssueList.jsx';
import DetailPane from './DetailPane.jsx';
import StatusBar from './StatusBar.jsx';
import { applyFix } from './FixEngine.jsx';
import { isOllamaAvailable, getAvailableModels, selectBestModel, streamSuggestion } from '../ai/ollama.js';
import { buildPrompt } from '../ai/prompt.js';
import { getCachedSuggestion, saveSuggestion } from '../ai/cache.js';
import { findMatchingPattern } from '../learning/matcher.js';
import { savePattern } from '../learning/patterns.js';

export default function App({ result }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showPreexisting, setShowPreexisting] = useState(false);
  const [fixStatus, setFixStatus] = useState(null);
  const [isForceMode, setIsForceMode] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showStreakWarning, setShowStreakWarning] = useState(false);
  const [aiState, setAiState] = useState({
    status: 'idle',
    tokens: '',
    patternMatch: null,
    abortController: null,
  });

  // Flatten all issues for navigation
  const allIssues = [
    ...result.blocking,
    ...result.warnings,
    ...result.minor,
    ...(showPreexisting ? result.preexisting : []),
  ];

  const selectedIssue = allIssues[selectedIndex] || null;

  // Update scroll position when selected index changes
  useEffect(() => {
    const availableHeight = Math.max(10, process.stdout.rows - 6);
    if (selectedIndex >= scrollOffset + availableHeight) {
      setScrollOffset(selectedIndex - availableHeight + 1);
    } else if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    }
  }, [selectedIndex]);

  // Pulsing streak warning effect
  useEffect(() => {
    if (result.streakAtRisk) {
      const interval = setInterval(() => {
        setShowStreakWarning((prev) => !prev);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [result.streakAtRisk]);

  // Handle keyboard input
  useInput((input, key) => {
    if (isForceMode) {
      // In force-commit mode, only handle Enter and Esc
      if (key.return) {
        handleForceCommit();
      } else if (key.escape) {
        setIsForceMode(false);
        setForceReason('');
      }
      return;
    }

    // AI streaming mode - handle Esc to cancel
    if (aiState.status === 'streaming' && key.escape) {
      if (aiState.abortController) {
        aiState.abortController.abort();
      }
      setAiState({ status: 'idle', tokens: '', patternMatch: null, abortController: null });
      return;
    }

    // AI pattern found mode - handle y/n
    if (aiState.status === 'pattern-found') {
      if (input === 'y') {
        // Apply pattern (simplified for now)
        setAiState({ status: 'idle', tokens: '', patternMatch: null, abortController: null });
        return;
      } else if (input === 'n') {
        // Fall through to Ollama
        setAiState({ status: 'idle', tokens: '', patternMatch: null, abortController: null });
        return;
      }
    }

    // Navigation
    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(allIssues.length - 1, selectedIndex + 1));
    }

    // Actions
    else if (input === 'x') {
      handleFix();
    } else if (input === 's') {
      handleSkip();
    } else if (input === 'f') {
      setIsForceMode(true);
    } else if (input === 'p') {
      setShowPreexisting(!showPreexisting);
    } else if (input === 'a') {
      handleAiSuggestion();
    } else if (input === 'A') {
      handleSavePattern();
    } else if (input === 'q' || key.escape) {
      handleQuit();
    }
  });

  const handleFix = async () => {
    if (!selectedIssue) return;

    setFixStatus({ status: 'fixing', diff: null });

    const fixResult = await applyFix(selectedIssue);

    if (fixResult.success) {
      setFixStatus({ status: 'fixed', diff: fixResult.diff, message: fixResult.message });
    } else {
      setFixStatus({ status: 'failed', message: fixResult.message });
    }
  };

  const handleSkip = () => {
    // Move selected issue from blocking to a skip list (for now, just skip to next)
    if (selectedIndex < allIssues.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleAiSuggestion = async () => {
    if (!selectedIssue || aiState.status !== 'idle') {
      return;
    }

    const repoPath = process.cwd();
    const fileContent = readFileSync(selectedIssue.file, 'utf8');
    const fileLines = fileContent.split('\n');

    // Step 1: Check for pattern match
    setAiState({ status: 'checking-patterns', tokens: '', patternMatch: null, abortController: null });

    const patternMatch = findMatchingPattern(selectedIssue, fileLines, repoPath);

    if (patternMatch && patternMatch.score >= 80) {
      setAiState({
        status: 'pattern-found',
        tokens: '',
        patternMatch,
        abortController: null,
      });
      return;
    }

    // Step 2: Check cache
    const cached = getCachedSuggestion(selectedIssue, fileLines);
    if (cached) {
      setAiState({
        status: 'done',
        tokens: cached.suggestion,
        patternMatch: null,
        abortController: null,
      });
      return;
    }

    // Step 3: Check if Ollama is available
    const ollamaAvailable = await isOllamaAvailable();
    if (!ollamaAvailable) {
      setAiState({
        status: 'error',
        tokens: 'Ollama not running.\nStart: ollama serve\nPull: ollama pull deepseek-coder:6.7b',
        patternMatch: null,
        abortController: null,
      });
      return;
    }

    // Step 4: Stream from Ollama
    const models = await getAvailableModels();
    const model = await selectBestModel(models);

    if (!model) {
      setAiState({
        status: 'error',
        tokens: 'No models available.\nPull: ollama pull deepseek-coder:6.7b',
        patternMatch: null,
        abortController: null,
      });
      return;
    }

    const prompt = buildPrompt(selectedIssue, fileLines);
    let tokens = '';

    const controller = streamSuggestion(
      prompt,
      model,
      (chunk) => {
        tokens += chunk;
        setAiState({
          status: 'streaming',
          tokens,
          patternMatch: null,
          abortController: controller,
        });
      },
      () => {
        // On done
        saveSuggestion(selectedIssue, fileLines, tokens);
        setAiState({
          status: 'done',
          tokens,
          patternMatch: null,
          abortController: null,
        });
      },
      (err) => {
        setAiState({
          status: 'error',
          tokens: `Error: ${err.message}`,
          patternMatch: null,
          abortController: null,
        });
      }
    );
  };

  const handleSavePattern = async () => {
    if (!selectedIssue || aiState.status !== 'done' || !aiState.tokens) {
      return;
    }

    try {
      const repoPath = process.cwd();
      const fileContent = readFileSync(selectedIssue.file, 'utf8');

      const pattern = {
        rule: selectedIssue.rule,
        language: selectedIssue.language,
        before: fileContent.substring(0, 100), // Simplified
        after: aiState.tokens,
        file: selectedIssue.file,
        timestamp: new Date().toISOString(),
        source: 'ai',
        usageCount: 0,
      };

      savePattern(repoPath, pattern);

      // Show confirmation briefly
      setAiState({
        status: 'done',
        tokens: aiState.tokens + '\n\n✓ Saved to .codexa/patterns.json',
        patternMatch: null,
        abortController: null,
      });
    } catch (err) {
      // Silent fail
    }
  };

  const handleForceCommit = () => {
    logForceCommit(forceReason, result.blocking);
    process.exit(0);
  };

  const handleQuit = () => {
    process.exit(result.blocking.length > 0 ? 1 : 0);
  };

  // Header
  let headerText = `codexa  ●  ${allIssues.length} issues  ●  🔴 ${result.blocking.length}  🟡 ${result.warnings.length}  ⚪ ${result.minor.length}`;

  // Add streak and warning to header
  if (result.streakDisplay) {
    if (result.streakAtRisk && showStreakWarning) {
      headerText += `  ●  ${chalk.red('⚠ streak at risk!')}`;
    } else if (result.streakDisplay.includes('🔥') || result.streakDisplay.includes('💎')) {
      headerText += `  ●  ${chalk.yellow(result.streakDisplay)}`;
    } else {
      headerText += `  ●  ${result.streakDisplay}`;
    }
  }

  return (
    <Box flexDirection="column" width="100%" height={process.stdout.rows}>
      {/* HEADER */}
      <Box paddingX={1} paddingY={1} borderBottom borderStyle="round" borderColor="gray">
        <Text>{chalk.cyan(headerText)}</Text>
      </Box>

      {/* MAIN CONTENT */}
      <Box flex={1} flexDirection="row" width="100%">
        <IssueList
          issues={allIssues}
          selectedIndex={selectedIndex}
          showPreexisting={showPreexisting}
          scrollOffset={scrollOffset}
        />
        <DetailPane issue={selectedIssue} fixStatus={fixStatus} aiState={aiState} />
      </Box>

      {/* STATUS BAR */}
      <StatusBar
        result={result}
        isForceMode={isForceMode}
        forceReason={forceReason}
        onForceReasonChange={setForceReason}
      />
    </Box>
  );
}

/**
 * Log force commit to .codexa/force-log.json
 */
function logForceCommit(reason, blockedErrors) {
  try {
    const repoRoot = process.cwd();
    const logDir = resolve(repoRoot, '.codexa');
    const logFile = resolve(logDir, 'force-log.json');

    // Ensure directory exists
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Read existing log
    let logs = [];
    if (existsSync(logFile)) {
      const content = readFileSync(logFile, 'utf8');
      logs = JSON.parse(content);
    }

    // Get git info
    let author = 'unknown';
    let branch = 'unknown';

    try {
      author = execSync('git config user.email', { encoding: 'utf8' }).trim();
      branch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf8',
      }).trim();
    } catch {
      // Ignore git errors
    }

    // Append new log entry
    logs.push({
      timestamp: new Date().toISOString(),
      reason,
      skippedErrors: blockedErrors.map((e) => ({
        file: e.file,
        line: e.line,
        rule: e.rule,
        severity: e.severity,
      })),
      author,
      branch,
    });

    // Write back
    writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to log force commit:', err.message);
  }
}
