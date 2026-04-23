/**
 * Build prompts for AI suggestions based on error context
 */

export function buildPrompt(error, fileLines) {
  const contextLines = getContextLines(error, fileLines);
  const formattedContext = formatContext(contextLines, error.line);

  const systemPrompt = `You are a senior ${error.language} developer reviewing code before a commit.
Be concise. Suggest only what fixes the specific error. Show fix as code.`;

  const taskPrompt = getSeverityTask(error.severity);

  const prompt = `${systemPrompt}

FILE CONTEXT:
${formattedContext}

ERROR:
Line ${error.line}: ${error.message}
Rule: ${error.rule}  Severity: ${error.severity}

TASK:
${taskPrompt}

Please provide your suggestion in this format:
1. One-sentence diagnosis (max 15 words)
2. Fixed code block (corrected lines only)
3. Brief explanation (one line, optional for MINOR)`;

  return prompt;
}

/**
 * Get context lines (10 lines around the error)
 */
function getContextLines(error, fileLines) {
  const errorLine = error.line - 1; // Convert to 0-indexed
  const contextStart = Math.max(0, errorLine - 5);
  const contextEnd = Math.min(fileLines.length, errorLine + 6);

  return fileLines.slice(contextStart, contextEnd).map((line, idx) => ({
    lineNum: contextStart + idx + 1,
    text: line,
    isError: contextStart + idx + 1 === error.line,
  }));
}

/**
 * Format context with line numbers
 */
function formatContext(contextLines) {
  return contextLines
    .map((ctx) => {
      const marker = ctx.isError ? '>' : ' ';
      const lineNum = String(ctx.lineNum).padStart(3);
      return `${marker}${lineNum} │ ${ctx.text}`;
    })
    .join('\n');
}

/**
 * Get task instruction based on severity
 */
function getSeverityTask(severity) {
  switch (severity) {
    case 'CRITICAL':
      return 'This BLOCKS the commit. Show minimal fix that resolves the error.';
    case 'MODERATE':
      return 'Show clean fix and briefly note why it matters.';
    case 'MINOR':
      return 'Show the corrected line only. Keep it brief.';
    default:
      return 'Show fix as code.';
  }
}

/**
 * Extract just the code part from a full suggestion
 * Looks for code blocks between triple backticks or just the diff lines
 */
export function extractCodeFromSuggestion(suggestion) {
  // Try to extract code block
  const codeBlockMatch = suggestion.match(/```[\w]*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to extract diff-style lines
  const diffLines = suggestion
    .split('\n')
    .filter((line) => line.trim().startsWith('+') || line.trim().startsWith('-'))
    .join('\n');

  if (diffLines) {
    return diffLines;
  }

  // Return the whole thing if no structure detected
  return suggestion.trim();
}
