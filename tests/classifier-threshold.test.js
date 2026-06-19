import { describe, it, expect, vi } from 'vitest';
import { outputCIJson } from '../src/tui/renderer.js';

describe('Threshold logic in renderer', () => {
  it('does not fail when blocking errors < blockThreshold', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    outputCIJson({
      blocking: [{}],
      warnings: [],
      minor: [],
      preexisting: []
    }, { team: { blockThreshold: 2 } });

    expect(exitSpy).toHaveBeenCalledWith(0);
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.result).toBe('warned');

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('fails when blocking errors >= blockThreshold', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    outputCIJson({
      blocking: [{}, {}],
      warnings: [],
      minor: [],
      preexisting: []
    }, { team: { blockThreshold: 2 } });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.result).toBe('blocked');

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });
});
