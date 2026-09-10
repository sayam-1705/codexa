import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock heavy dependencies
vi.mock('../src/team/config.js', () => ({
  loadConfig: vi.fn(async () => ({ blameMode: 'strict' })),
}));

vi.mock('../src/git/hooks.js', () => ({
  isHookInstalled: vi.fn(() => false),
}));

vi.mock('../src/profiles/eslintConfig.js', () => ({
  buildEslintOptions: vi.fn(() => ({ useEslintrc: false })),
}));

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
    isHookInstalled.mockReturnValue(false);

    await expect(doctorCommand({})).resolves.not.toThrow();
  });

  it('outputs Codexa Doctor header', async () => {
    await doctorCommand({});

    const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(allOutput).toMatch(/Codexa Doctor/i);
  });

  it('calls process.exit(1) in strict mode when checks fail', async () => {
    isHookInstalled.mockReturnValue(false); // hook missing = fail

    await doctorCommand({ strict: true });

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
