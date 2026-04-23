/**
 * Generate badge data for CI results.
 * @param {string} result - Result status: blocked | warned | clean
 * @returns {Object} - { url: String, markdown: String }
 */
export function getBadgeData(result) {
  const badges = {
    blocked: {
      url: 'https://img.shields.io/badge/codexa-blocked-FF4444',
      markdown: '![Codexa](https://img.shields.io/badge/codexa-blocked-FF4444)',
    },
    warned: {
      url: 'https://img.shields.io/badge/codexa-warnings-F5C842',
      markdown: '![Codexa](https://img.shields.io/badge/codexa-warnings-F5C842)',
    },
    clean: {
      url: 'https://img.shields.io/badge/codexa-clean-00E5A0',
      markdown: '![Codexa](https://img.shields.io/badge/codexa-clean-00E5A0)',
    },
  };

  return badges[result] || badges.clean;
}

/**
 * Get badge installation instructions.
 * @returns {string} - Markdown instructions
 */
export function getBadgeInstallInstructions() {
  return `
## Add Codexa Badge to README

Paste this into your README.md to show your code quality status:

\`\`\`markdown
[![Codexa](https://img.shields.io/badge/codexa-clean-00E5A0)](https://github.com/anthropics/codexa)
\`\`\`

The badge updates on every commit. Replace the URL with your repository if desired.
`;
}
