import React from 'react';
import { Text } from 'ink';
import chalk from 'chalk';

export default function Badge({ severity, size = 'sm' }) {
  const sizeMap = {
    sm: {
      CRITICAL: '[CRIT]',
      MODERATE: '[MOD]',
      MINOR: '[MIN]',
    },
    lg: {
      CRITICAL: 'CRITICAL',
      MODERATE: 'MODERATE',
      MINOR: 'MINOR',
    },
  };

  const colorMap = {
    CRITICAL: chalk.bgRed.white,
    MODERATE: chalk.yellow,
    MINOR: chalk.dim,
  };

  const text = sizeMap[size][severity] || sizeMap.sm[severity];
  const colorFn = colorMap[severity] || chalk.dim;

  return React.createElement(Text, null, colorFn(text));
}
