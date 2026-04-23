import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Mock console and process
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

describe('renderer', () => {
  beforeEach(() => {
    consoleLogSpy.mockClear();
    processExitSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should output JSON in CI mode when called', async () => {
    const { outputCIJson } = await import('../src/tui/renderer.js');

    const result = {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    outputCIJson(result);

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toHaveProperty('codexa');
    expect(output).toHaveProperty('timestamp');
    expect(output).toHaveProperty('result');
  });

  it('should include all required fields in CI JSON output', async () => {
    const { outputCIJson } = await import('../src/tui/renderer.js');

    const error = {
      file: 'test.js',
      line: 1,
      col: 5,
      message: 'test error',
      rule: 'test-rule',
      severity: 'CRITICAL',
      language: 'javascript',
      isInDiff: true,
      blameCategory: 'yours',
    };

    const result = {
      blocking: [error],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    outputCIJson(result);

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.blocking).toHaveLength(1);
    expect(output.blocking[0]).toHaveProperty('file');
    expect(output.blocking[0]).toHaveProperty('line');
    expect(output.blocking[0]).toHaveProperty('severity');
    expect(output.summary).toHaveProperty('total');
    expect(output.summary).toHaveProperty('blocking');
  });

  it('should set result to "blocked" when blocking errors exist', async () => {
    const { outputCIJson } = await import('../src/tui/renderer.js');

    const result = {
      blocking: [{ severity: 'CRITICAL' }],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    outputCIJson(result);

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.result).toBe('blocked');
  });

  it('should set result to "warned" when only warnings exist', async () => {
    const { outputCIJson } = await import('../src/tui/renderer.js');

    const result = {
      blocking: [],
      warnings: [{ severity: 'MODERATE' }],
      minor: [],
      preexisting: [],
    };

    outputCIJson(result);

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.result).toBe('warned');
  });

  it('should set result to "clean" when no errors exist', async () => {
    const { outputCIJson } = await import('../src/tui/renderer.js');

    const result = {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    outputCIJson(result);

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.result).toBe('clean');
  });

  it('should exit with code 1 when result is "blocked"', async () => {
    const { outputCIJson } = await import('../src/tui/renderer.js');

    const result = {
      blocking: [{ severity: 'CRITICAL' }],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    outputCIJson(result);

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with code 0 when result is not "blocked"', async () => {
    const { outputCIJson } = await import('../src/tui/renderer.js');

    const result = {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    outputCIJson(result);

    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
});
