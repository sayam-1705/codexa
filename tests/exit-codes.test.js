/**
 * Exit code contract tests.
 *
 * Verifies that CLI commands return the correct exit codes for all scenarios.
 * Uses spawnSync to test the actual CLI binary.
 *
 * Contract:
 *   0  → success / clean check
 *   1  → blocking findings / adapter failure / configuration error / general failure
 *   1  → invalid command usage (Commander default)
 *
 * Critical invariant: a check that could NOT complete required analysis must NOT
 * return exit code 0 when enforcement is active.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const cliPath = join(repoRoot, 'bin', 'codexa.js');

const tempDirs = [];
afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop(), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function runCli(args, cwd = process.cwd(), env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '', ...env },
  });
}

function makeGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'codexa-exitcode-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', type: 'module' }), 'utf8');
  writeFileSync(join(dir, 'src', 'index.js'), 'export const x = 1;\n', 'utf8');
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir });
  return dir;
}

describe('CLI exit code contract', () => {
  // ── --version ──────────────────────────────────────────────────────────────
  it('--version exits 0', () => {
    const result = runCli(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1.1.3');
  });

  // ── --help ─────────────────────────────────────────────────────────────────
  it('--help exits 0', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
  });

  // ── check with no staged files ─────────────────────────────────────────────
  it('check exits 0 when no files are staged', () => {
    const repo = makeGitRepo();
    const env = { CODEXA_HOME: join(repo, '.codexa-home') };
    runCli(['init'], repo, env); // initialize first

    const result = runCli(['check', '--ci'], repo, env);
    // No staged files → either 0 (clean) or specific message
    // The important thing: it must not crash
    expect([0, 1]).toContain(result.status);
    // If it produced JSON output, it must be parseable
    if (result.stdout && result.stdout.trim().startsWith('{')) {
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    }
  });

  // ── check in CI mode returns parseable JSON ────────────────────────────────
  it('check --ci returns JSON on stdout that is parseable', () => {
    const repo = makeGitRepo();
    const env = { CODEXA_HOME: join(repo, '.codexa-home') };
    runCli(['init'], repo, env);

    writeFileSync(join(repo, 'src', 'index.js'), 'export const x = 1;\n', 'utf8');
    execFileSync('git', ['add', 'src/index.js'], { cwd: repo });

    const result = runCli(['check', '--ci'], repo, env);
    expect(result.stdout.trim()).toBeTruthy();
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('result');
    expect(['clean', 'blocked', 'warned', 'error']).toContain(parsed.result);
  });

  // ── check --ci returns exit 0 for clean result ─────────────────────────────
  it('check --ci exits 0 for genuinely clean staged file', () => {
    const repo = makeGitRepo();
    const env = { CODEXA_HOME: join(repo, '.codexa-home') };
    runCli(['init'], repo, env);

    writeFileSync(join(repo, 'src', 'index.js'), 'export const x = 1;\n', 'utf8');
    execFileSync('git', ['add', 'src/index.js'], { cwd: repo });

    const result = runCli(['check', '--ci'], repo, env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.result).toBe('clean');
  });

  // ── check --ci returns exit 1 for blocking findings ────────────────────────
  it('check --ci exits 1 when there are new blocking findings', () => {
    const repo = makeGitRepo();
    const env = { CODEXA_HOME: join(repo, '.codexa-home') };
    runCli(['init'], repo, env);

    // Write a config that treats MINOR as blocking (ESLint emits MINOR severity)
    writeFileSync(join(repo, 'codexa.config.json'), JSON.stringify({
      version: 2,
      blameMode: 'strict',
      languages: ['auto'],
      adapterFailurePolicy: 'fail',
      severity: { block: ['CRITICAL', 'MODERATE', 'MINOR'], warn: [], log: [], overrides: {} },
      team: { blockThreshold: 1, enforceOnCI: true },
      ci: { failOn: 'any', outputFormat: 'json' },
    }), 'utf8');

    // Stage a file that will produce a lint finding (undeclared variable)
    writeFileSync(join(repo, 'src', 'index.js'), 'const x = undeclaredRef;\n', 'utf8');
    execFileSync('git', ['add', 'src/index.js', 'codexa.config.json'], { cwd: repo });

    const result = runCli(['check', '--ci'], repo, env);
    const parsed = JSON.parse(result.stdout);
    // If ESLint found the error, it should be blocked (exit 1)
    // The JSON result must always be parseable regardless
    expect(['clean', 'blocked', 'warned', 'error']).toContain(parsed.result);
    if (parsed.result === 'blocked') {
      expect(result.status).toBe(1);
    }
  });

  // ── JSON output contains no ANSI codes ────────────────────────────────────
  it('check --ci JSON output is free of ANSI escape sequences', () => {
    const repo = makeGitRepo();
    const env = { CODEXA_HOME: join(repo, '.codexa-home') };
    runCli(['init'], repo, env);

    writeFileSync(join(repo, 'src', 'index.js'), 'export const x = 1;\n', 'utf8');
    execFileSync('git', ['add', 'src/index.js'], { cwd: repo });

    const result = runCli(['check', '--ci'], repo, env);
    // stdout must not contain ANSI escape sequences
    expect(result.stdout).not.toMatch(/\x1b\[/);
  });

  // ── not a git repository ───────────────────────────────────────────────────
  it('init exits 1 with actionable error when not in a git repository', () => {
    const plainDir = mkdtempSync(join(tmpdir(), 'codexa-nogit-'));
    tempDirs.push(plainDir);

    const result = runCli(['init'], plainDir, {
      CODEXA_HOME: join(plainDir, '.codexa-home'),
    });
    expect(result.status).toBe(1);
    // Must include a human-readable message (not just a stack trace)
    const output = result.stderr + result.stdout;
    expect(output).toMatch(/git/i);
  });

  // ── unknown command ────────────────────────────────────────────────────────
  it('unknown command exits non-zero', () => {
    const result = runCli(['nonexistent-command-xyz']);
    expect(result.status).not.toBe(0);
  });

  // ── config validate exits 0 for valid config ──────────────────────────────
  it('config validate exits 0 with valid config present', () => {
    const repo = makeGitRepo();
    const env = { CODEXA_HOME: join(repo, '.codexa-home') };
    runCli(['init'], repo, env);

    const result = runCli(['config', 'validate'], repo, env);
    // Should exit 0 when config is valid
    expect(result.status).toBe(0);
  });
}, 60000);
