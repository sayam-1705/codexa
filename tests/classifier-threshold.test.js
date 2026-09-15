import { describe, it, expect, vi } from 'vitest';
import { outputCIJson } from '../src/tui/renderer.js';

describe('Threshold logic in renderer', () => {
  it('does not fail when blocking errors < blockThreshold', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    outputCIJson({
      blocking: [{}],
      warnings: [],
      minor: [],
      preexisting: [],
      ciAllowed: true // Below threshold
    });

    expect(process.exitCode).toBe(0);
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.result).toBe('warned');

    logSpy.mockRestore();
  });

  it('fails when blocking errors >= blockThreshold', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    outputCIJson({
      blocking: [{}, {}],
      warnings: [],
      minor: [],
      preexisting: [],
      ciAllowed: false // Above threshold
    });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.result).toBe('blocked');

    logSpy.mockRestore();
  });
});
