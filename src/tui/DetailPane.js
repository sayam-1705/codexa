import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { readFileSync } from 'fs';
import chalk from 'chalk';
import Badge from './Badge.js';

export default function DetailPane({ issue, fixStatus, aiState = null }) {
  // Read file content and extract context
  const fileContext = useMemo(() => {
    if (!issue || !issue.file) return null;

    try {
      const content = readFileSync(issue.file, 'utf8');
      const lines = content.split('\n');

      // Get context: 5 lines before and after
      const errorLine = issue.line - 1; // Convert to 0-indexed
      const contextStart = Math.max(0, errorLine - 5);
      const contextEnd = Math.min(lines.length, errorLine + 6);

      const contextLines = lines.slice(contextStart, contextEnd).map((line, idx) => {
        const lineNum = contextStart + idx + 1;
        const isError = lineNum === issue.line;
        const marker = isError ? '>' : ' ';
        const lineStr = `${String(lineNum).padStart(3)} │ ${line}`;

        return {
          lineNum,
          isError,
          text: isError ? chalk.bgRed.white(lineStr) : chalk.dim(lineStr),
        };
      });

      return { contextLines, errorLine };
    } catch (err) {
      return null;
    }
  }, [issue]);

  if (!issue) {
    return (
      <Box
        flexDirection="column"
        width="65%"
        paddingLeft={1}
        paddingRight={1}
      >
        <Text dimColor>No issue selected</Text>
      </Box>
    );
  }

  const langLabel = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
  }[issue.language] || 'text';

  return (
    <Box
      flexDirection="column"
      width="65%"
      paddingLeft={1}
      paddingRight={1}
      borderStyle="round"
      borderColor="gray"
    >
      {/* FILE HEADER */}
      <Box marginBottom={1}>
        <Text>
          {chalk.cyan(issue.file)} {chalk.dim('·')} line {chalk.yellow(issue.line)}{' '}
          {chalk.dim('·')} col {chalk.yellow(issue.col)} {chalk.dim(`·`)} {langLabel}
        </Text>
      </Box>

      {/* ERROR MESSAGE */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold>{issue.message}</Text>
        <Box>
          <Text dimColor>Rule: {issue.rule}</Text>
          <Text dimColor> {chalk.dim('·')} </Text>
          <Badge severity={issue.severity} size="lg" />
        </Box>
      </Box>

      {/* SEPARATOR */}
      <Text dimColor>─────────────────────────────────────</Text>

      {/* CODE CONTEXT */}
      {fileContext ? (
        <Box flexDirection="column" marginBottom={1}>
          {fileContext.contextLines.map((ctx) => (
            <Text key={ctx.lineNum}>{ctx.text}</Text>
          ))}
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text dimColor>[Unable to read file context]</Text>
        </Box>
      )}

      {/* SEPARATOR */}
      <Text dimColor>─────────────────────────────────────</Text>

      {/* FIX STATUS */}
      <Box flexDirection="column" marginTop={1}>
        {!fixStatus || fixStatus.status === 'idle' ? (
          <Text dimColor>Press [x] to auto-fix this issue</Text>
        ) : fixStatus.status === 'fixing' ? (
          <Box>
            <Text>⟳ </Text>
            <Text>Applying fix...</Text>
          </Box>
        ) : fixStatus.status === 'fixed' ? (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>{chalk.green('✓')} Fixed — re-linting...</Text>
            </Box>
            {fixStatus.diff && (
              <Box flexDirection="column" marginBottom={1}>
                {fixStatus.diff.split('\n').map((line, idx) => (
                  <Text key={idx}>
                    {line.startsWith('+')
                      ? chalk.green(line)
                      : line.startsWith('-')
                        ? chalk.red(line)
                        : line}
                  </Text>
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <Box>
            <Text>{chalk.red('✗')} No auto-fix available for this rule</Text>
          </Box>
        )}
      </Box>

      {/* AI SLOT */}
      <Box marginTop={1} flexDirection="column" borderTop borderStyle="round" borderColor="gray" paddingTop={1}>
        {!aiState || aiState.status === 'idle' ? (
          <Text dimColor>[a] AI suggestion  [A] save pattern</Text>
        ) : aiState.status === 'checking-patterns' ? (
          <Box>
            <Text>Checking your fix history...</Text>
          </Box>
        ) : aiState.status === 'pattern-found' ? (
          <Box flexDirection="column">
            <Text bold>MEMORY HIT</Text>
            <Box marginTop={1} marginBottom={1}>
              <Text>{aiState.patternMatch.message}</Text>
            </Box>
            <Box marginBottom={1} flexDirection="column">
              {aiState.patternMatch.pattern.before && (
                <Text>{chalk.red('- ' + aiState.patternMatch.pattern.before)}</Text>
              )}
              {aiState.patternMatch.pattern.after && (
                <Text>{chalk.green('+ ' + aiState.patternMatch.pattern.after)}</Text>
              )}
            </Box>
            <Text dimColor>[y] Apply  [n] Ask Ollama</Text>
          </Box>
        ) : aiState.status === 'streaming' ? (
          <Box flexDirection="column">
            <Text dimColor>deepseek-coder:6.7b</Text>
            <Box marginTop={1} marginBottom={1}>
              <Text>{aiState.tokens}</Text>
              <Text>|</Text>
            </Box>
            <Text dimColor>[Esc] cancel</Text>
          </Box>
        ) : aiState.status === 'done' ? (
          <Box flexDirection="column">
            <Text dimColor>deepseek-coder:6.7b</Text>
            <Box marginTop={1} marginBottom={1}>
              <Text>{aiState.tokens}</Text>
            </Box>
            <Text dimColor>[A] save to memory  [x] apply fix</Text>
          </Box>
        ) : aiState.status === 'error' ? (
          <Box flexDirection="column">
            <Text>{chalk.red('Ollama unavailable')}</Text>
            <Box marginTop={1}>
              <Text>{aiState.tokens}</Text>
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
