import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import Badge from './Badge.js';

export default function IssueList({
  issues,
  selectedIndex,
  showPreexisting,
  scrollOffset,
}) {
  // Separate issues into yours and preexisting
  const yourIssues = issues.filter((i) => i.blameCategory !== 'preexisting');
  const preexistingIssues = issues.filter((i) => i.blameCategory === 'preexisting');

  // Build the display list
  const displayList = showPreexisting
    ? [...yourIssues, ...preexistingIssues]
    : yourIssues;

  // Calculate visible window
  const availableHeight = Math.max(10, process.stdout.rows - 6);
  const visibleStart = Math.max(
    0,
    Math.min(scrollOffset, displayList.length - availableHeight)
  );
  const visibleEnd = Math.min(visibleStart + availableHeight, displayList.length);

  const visibleIssues = displayList.slice(visibleStart, visibleEnd);

  return (
    <Box
      flexDirection="column"
      width="35%"
      paddingRight={1}
      borderStyle="round"
      borderColor="gray"
    >
      {visibleIssues.map((issue, visibleIdx) => {
        const absoluteIdx = visibleStart + visibleIdx;
        const isSelected = absoluteIdx === selectedIndex;
        const isPreexisting = issue.blameCategory === 'preexisting';

        // Show section divider before preexisting
        const showDivider =
          isPreexisting &&
          absoluteIdx > 0 &&
          displayList[absoluteIdx - 1].blameCategory !== 'preexisting';

        const langIcon = getLanguageIcon(issue.language);
        const fileName = `${issue.file.split('/').pop()}${langIcon}`;

        return (
          <Box key={`${issue.file}-${issue.line}-${absoluteIdx}`} flexDirection="column">
            {showDivider && (
              <Text dimColor>
                ── NOT YOUR FAULT ─────────────────────────────────
              </Text>
            )}
            <Box>
              <Text>{isSelected ? '▶ ' : '  '}</Text>
              <Badge severity={issue.severity} size="sm" />
              <Text> </Text>
              <Text>{isPreexisting ? chalk.dim(fileName) : fileName}</Text>
              <Text dimColor>:{issue.line}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function getLanguageIcon(language) {
  const icons = {
    javascript: chalk.cyan(' TS'),
    typescript: chalk.cyan(' TS'),
    python: chalk.blue(' PY'),
  };
  return icons[language] || '';
}
