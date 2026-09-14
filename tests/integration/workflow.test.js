import { afterEach, describe, expect, it } from 'vitest';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { spawnSync, execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';

const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
const cliPath = join(repoRoot, 'bin', 'codexa.js');
const consumerFixture = join(repoRoot, 'tests', 'fixtures', 'consumer-project');
const tempRepos = [];
const execFileAsync = promisify(execFile);

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function runCli(repo, args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function createRepository() {
  const repo = mkdtempSync(join(tmpdir(), 'codexa-integration-'));
  tempRepos.push(repo);
  cpSync(consumerFixture, repo, { recursive: true });
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 'fixture@example.test']);
  git(repo, ['config', 'user.name', 'Codexa Fixture']);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', 'initial']);
  return repo;
}

afterEach(() => {
  while (tempRepos.length) rmSync(tempRepos.pop(), { recursive: true, force: true });
});

describe('repository integration workflow', () => {
  it('initializes, baselines, checks the staged index, and blocks a new finding', () => {
    const repo = createRepository();

    const init = runCli(repo, ['init']);
    expect(init.status).toBe(0);
    expect(existsSync(join(repo, '.codexa', 'baseline.json'))).toBe(true);
    expect(existsSync(join(repo, '.git', 'hooks', 'pre-commit'))).toBe(true);

    const source = join(repo, 'src', 'index.js');
    writeFileSync(source, 'export const answer = 43;\n', 'utf8');
    git(repo, ['add', source]);
    writeFileSync(source, 'export const answer = ;\n', 'utf8');

    const stagedCheck = runCli(repo, ['check', '--ci']);
    expect(stagedCheck.status).toBe(0);
    expect(JSON.parse(stagedCheck.stdout).result).toBe('clean');

    writeFileSync(source, 'export const answer = missingValue;\n', 'utf8');
    git(repo, ['add', source]);
    const blocked = runCli(repo, ['check', '--ci']);
    expect(blocked.status).toBe(1);
    const output = JSON.parse(blocked.stdout);
    expect(output.result).toBe('blocked');
    expect(output.blocking.some((finding) => finding.rule === 'no-undef')).toBe(true);
  });

  it('executes and restores an existing hook during uninstall', () => {
    const repo = createRepository();
    const hook = join(repo, '.git', 'hooks', 'pre-commit');
    const originalMarker = join(repo, 'original-hook-ran');
    const original = `#!/bin/sh\nprintf original > "$CODEXA_HOOK_MARKER"\nexit 0\n`;
    writeFileSync(hook, original, 'utf8');
    chmodSync(hook, 0o755);

    expect(runCli(repo, ['init']).status).toBe(0);
    const fakeBin = mkdtempSync(join(tmpdir(), 'codexa-fake-bin-'));
    tempRepos.push(fakeBin);
    const fakeCodexa = join(fakeBin, 'codexa');
    writeFileSync(fakeCodexa, '#!/bin/sh\nprintf codexa > "$CODEXA_CODEX_MARKER"\nexit 0\n', 'utf8');
    chmodSync(fakeCodexa, 0o755);

    const hookRun = spawnSync(hook, [], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        CODEXA_HOOK_MARKER: originalMarker,
        CODEXA_CODEX_MARKER: join(repo, 'codexa-hook-ran'),
      },
    });
    expect(hookRun.status).toBe(0);
    expect(readFileSync(originalMarker, 'utf8')).toBe('original');
    expect(readFileSync(join(repo, 'codexa-hook-ran'), 'utf8')).toBe('codexa');

    expect(runCli(repo, ['uninstall', '--yes']).status).toBe(0);
    expect(readFileSync(hook, 'utf8')).toBe(original);
  });

  it('installs the packed CLI into a clean consumer project', async () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'codexa-package-'));
    tempRepos.push(packageDir);
    await execFileAsync('npm', ['pack', '--pack-destination', packageDir], { cwd: repoRoot });
    const tarball = join(packageDir, 'codexa-toolkit-1.1.3.tgz');
    const consumer = join(packageDir, 'consumer');
    mkdirSync(consumer);
    cpSync(consumerFixture, consumer, { recursive: true });
    await execFileAsync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
      cwd: consumer,
    });
    const version = spawnSync(join(consumer, 'node_modules', '.bin', 'codexa'), ['--version'], {
      cwd: consumer,
      encoding: 'utf8',
    });
    expect(version.status).toBe(0);
    expect(version.stdout).toContain('codexa 1.1.3');
  }, 120000);
});
