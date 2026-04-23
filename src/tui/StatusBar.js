import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import TextInput from 'ink-text-input';

export default function StatusBar({
  result,
  isForceMode,
  forceReason,
  onForceReasonChange,
}) {
  const { blocking, warnings, minor, preexisting } = result;

  // Determine status
  let statusText = '✓ CLEAN';
  let statusColor = chalk.green;

  if (blocking.length > 0) {
    statusText = '✖ BLOCKED';
    statusColor = chalk.red;
  } else if (warnings.length > 0) {
    statusText = '⚠ WARNINGS';
    statusColor = chalk.yellow;
  }

  // Count badges
  let counts = `🔴 ${blocking.length}  🟡 ${warnings.length}  ⚪ ${minor.length}  📦 ${preexisting.length}`;

  // Add streak to center if present
  if (result.streakDisplay) {
    if (result.streakAtRisk) {
      counts += `  ·  ${chalk.red('⚠ streak!')}`
    } else {
      counts += `  ·  ${result.streakDisplay}`;
    }
  }

  if (isForceMode) {
    return (
      <Box
        flexDirection="column"
        width="100%"
        borderTop
        borderStyle="round"
        borderColor="gray"
        paddingTop={1}
        paddingX={1}
      >
        <Box marginBottom={1}>
          <Text bold>REASON FOR FORCE COMMIT: </Text>
        </Box>
        <TextInput
          placeholder="Enter reason..."
          value={forceReason}
          onChange={onForceReasonChange}
        />
        <Box marginTop={1}>
          <Text dimColor>
            [Enter] confirm  [Esc] cancel
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>{chalk.red.bold('Warning:')} Force commits are logged to .codexa/force-log.json</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      width="100%"
      borderTop
      borderStyle="round"
      borderColor="gray"
      paddingTop={1}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text>{statusColor(statusText)}</Text>
      <Text dimColor>{counts}</Text>
      <Text dimColor>
        [↑↓] nav  [x] fix  [s] skip  [f] force  [p] pre-existing  [q] quit
      </Text>
    </Box>
  );
}
