/**
 * Render a sparkline chart using Unicode block characters.
 * Maps normalized values (0-8) to Unicode bar characters.
 * @param {Array<number>} values - Array of numeric values to visualize
 * @param {Object} options - Rendering options
 *   @property {number} width - Max width in characters (default: 40)
 *   @property {string} label - Optional label prefix
 *   @property {boolean} showMinMax - Show min/max values (default: true)
 * @returns {string} - Formatted sparkline string
 */
export function renderSparkline(values, options = {}) {
  const { width = 40, label = '', showMinMax = true } = options;

  if (!values || values.length === 0) {
    return label ? `${label}: (no data)` : '(no data)';
  }

  // Unicode block characters (▁▂▃▄▅▆▇█)
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  // Find min and max
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Normalize values and sample if needed
  let normalized = values.map((v) => {
    if (max === min) {
      return 4; // Middle bar if all values are the same
    }
    const normalized = ((v - min) / (max - min)) * 7;
    return Math.round(normalized);
  });

  // Sample down to width if necessary
  if (normalized.length > width) {
    const sampleSize = Math.ceil(normalized.length / width);
    const sampled = [];
    for (let i = 0; i < normalized.length; i += sampleSize) {
      const chunk = normalized.slice(i, i + sampleSize);
      const avg = Math.round(chunk.reduce((a, b) => a + b, 0) / chunk.length);
      sampled.push(avg);
    }
    normalized = sampled;
  }

  // Convert to block characters
  const sparkline = normalized.map((n) => blocks[Math.max(0, Math.min(7, n))]).join('');

  // Build output
  let output = sparkline;

  if (showMinMax) {
    output += ` [${Math.round(min)}-${Math.round(max)}]`;
  }

  if (label) {
    output = `${label}: ${output}`;
  }

  return output;
}

/**
 * Render multiple sparklines in a table format.
 * @param {Object} data - {title: values, ...}
 * @param {Object} options - {width, showMinMax, showLegend}
 * @returns {string} - Formatted multi-line table
 */
export function renderSparklineTable(data, options = {}) {
  const { width = 30, showMinMax = true } = options;

  const lines = [];

  for (const [label, values] of Object.entries(data)) {
    const sparkline = renderSparkline(values, { width, label, showMinMax });
    lines.push(sparkline);
  }

  return lines.join('\n');
}

/**
 * Render a simple bar chart using block characters.
 * @param {Array<{label, value}>} items - Items to render
 * @param {Object} options - {maxWidth, maxValue}
 * @returns {string} - Formatted chart
 */
export function renderBarChart(items, options = {}) {
  const { maxWidth = 40, maxValue = null } = options;

  if (!items || items.length === 0) {
    return '(no data)';
  }

  // Determine max value
  const max = maxValue || Math.max(...items.map((i) => i.value));

  const lines = items.map((item) => {
    const barLength = max > 0 ? Math.round((item.value / max) * maxWidth) : 0;
    const bar = '█'.repeat(barLength);
    return `${item.label.padEnd(15)} ${bar} ${item.value}`;
  });

  return lines.join('\n');
}

/**
 * Create a simple gauge display (0-100).
 * @param {number} value - Value 0-100
 * @param {string} label - Optional label
 * @returns {string} - Gauge string
 */
export function renderGauge(value, label = '') {
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const clamped = Math.max(0, Math.min(100, value));
  const index = Math.round((clamped / 100) * 7);

  let color = '';
  if (clamped >= 80) {
    color = '\x1b[32m'; // green
  } else if (clamped >= 60) {
    color = '\x1b[33m'; // yellow
  } else {
    color = '\x1b[31m'; // red
  }

  const reset = '\x1b[0m';
  const gauge = `${color}${blocks[index]}${reset}`;

  if (label) {
    return `${label}: ${gauge} ${clamped}%`;
  }

  return `${gauge} ${clamped}%`;
}

/**
 * Render a trend indicator (up/down/stable with percentage).
 * @param {number} previous - Previous value
 * @param {number} current - Current value
 * @returns {string} - Trend indicator
 */
export function renderTrend(previous, current) {
  if (previous === 0) {
    return '—';
  }

  const change = current - previous;
  const percentChange = ((change / previous) * 100).toFixed(1);

  if (change > 0) {
    return `↑ +${percentChange}%`;
  } else if (change < 0) {
    return `↓ ${percentChange}%`;
  } else {
    return '→ 0%';
  }
}
