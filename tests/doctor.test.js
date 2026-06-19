import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock heavy dependencies
vi.mock('../src/ai/ollama.js', () => ({
  isOllamaAvailable: vi.fn(),
  getAvailableModels: vi.fn(() => []),
  selectBestModel: vi.fn(() => null),
}));

vi.mock('../src/team/config.js', () => ({
  loadConfig: vi.fn(async () => ({ ai: { enabled: true } })),
}));

vi.mock('../src/git/hooks.js', () => ({
  isHookInstalled: vi.fn(() => false),
}));

vi.mock('../src/profiles/eslintConfig.js', () => ({
  buildEslintOptions: vi.fn(() => ({ useEslintrc: false })),
}));

import { isOllamaAvailable } from '../src/ai/ollama.js';
import { isHookInstalled } from '../src/git/hooks.js';
import { doctorCommand } from '../src/commands/doctor.js';

describe('doctorCommand', () => {
  let logSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Prevent process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs without throwing', async () => {
    isOllamaAvailable.mockResolvedValue(false);
    isHookInstalled.mockReturnValue(false);

    await expect(doctorCommand({})).resolves.not.toThrow();
  });

  it('outputs Codexa Doctor header', async () => {
    isOllamaAvailable.mockResolvedValue(false);

    await doctorCommand({});

    const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(allOutput).toMatch(/Codexa Doctor/i);
  });

  it('reports Ollama reachable when available', async () => {
    isOllamaAvailable.mockResolvedValue(true);

    await doctorCommand({});

    const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(allOutput).toMatch(/Ollama reachable/i);
  });

  it('skips Ollama check when ai.enabled is false', async () => {
    const { loadConfig } = await import('../src/team/config.js');
    loadConfig.mockResolvedValue({ ai: { enabled: false } });
    isOllamaAvailable.mockResolvedValue(true);

    await doctorCommand({});

    // isOllamaAvailable should NOT be called
    expect(isOllamaAvailable).not.toHaveBeenCalled();
  });

  it('calls process.exit(1) in strict mode when checks fail', async () => {
    isOllamaAvailable.mockResolvedValue(false);
    isHookInstalled.mockReturnValue(false); // hook missing = fail

    await doctorCommand({ strict: true });

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
