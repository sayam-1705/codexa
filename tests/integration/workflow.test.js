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
import { fileURLToPath } from 'url';
import { spawnSync, execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';

// fileURLToPath correctly converts file:///C:/... URLs to C:\... on Windows.
// Using .pathname instead leaves a spurious leading slash (/C:/...) which
// causes path.resolve() to treat the drive letter as a directory component.
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const cliPath = join(repoRoot, 'bin', 'codexa.js');
const consumerFixture = join(repoRoot, 'tests', 'fixtures', 'consumer-project');
// The installed CLI shim in node_modules/.bin is "codexa.cmd" on Windows, "codexa" on Unix.
const binSuffix = process.platform === 'win32' ? '.cmd' : '';
const npm = 'npm' + binSuffix;
const tempRepos = [];
const execFileAsync = promisify(execFile);

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function runCli(repo, args, env = {}) {
  const options = {
    cwd: repo,
    encoding: 'utf8',
    // Keep the per-user adapter registry isolated between concurrently-run tests.
    env: { ...process.env, NODE_OPTIONS: '', CODEXA_HOME: join(repo, '.codexa-test-home'), ...env },
  };
  let result = spawnSync(process.execPath, [cliPath, ...args], options);
  // Some constrained CI sandboxes transiently reject process creation while a
  // just-finished child is being reaped. Retrying once keeps the smoke test
  // focused on the packaged CLI rather than that host artifact.
  if (result.error?.code === 'EPERM') {
    result = spawnSync(process.execPath, [cliPath, ...args], options);
  }
  return result;
}

function createRepository() {
  const repo = mkdtempSync(join(tmpdir(), 'codexa integration-'));
  tempRepos.push(repo);
  cpSync(consumerFixture, repo, { recursive: true });
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 'fixture@example.test']);
  git(repo, ['config', 'user.name', 'Codexa Fixture']);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', 'initial']);
  return repo;
}

afterEach(async () => {
  while (tempRepos.length) {
    const dir = tempRepos.pop();
    let retries = 5;
    while (retries > 0) {
      try {
        rmSync(dir, { recursive: true, force: true });
        break;
      } catch (err) {
        if (err.code === 'ENOTEMPTY' || err.code === 'EBUSY' || err.code === 'EPERM') {
          retries--;
          if (retries === 0) throw err;
          // Manual async sleep
          await new Promise((resolve) => setTimeout(resolve, 200));
        } else {
          throw err;
        }
      }
    }
  }
});

describe('repository integration workflow', () => {
  // Windows CI is 3-5× slower: cold Node+ESLint startup takes ~15-20s per
  // CLI invocation. This test makes 5 separate spawns, so 120s is appropriate.
  // The global testTimeout (30s) is too tight for Windows — set it explicitly here.
  it('initializes, baselines, checks the staged index, and blocks a new finding', () => {
    const repo = createRepository();

    const init = runCli(repo, ['init']);
    expect(init.status).toBe(0);
    expect(existsSync(join(repo, '.codexa', 'baseline.json'))).toBe(true);
    expect(existsSync(join(repo, '.git', 'hooks', 'pre-commit'))).toBe(true);

    const source = join(repo, 'src', 'index.js');
    writeFileSync(source, 'export const answer = missingValue;\n', 'utf8');
    const fullCheck = runCli(repo, ['check', '--ci']);
    expect(fullCheck.status).toBe(1);
    expect(JSON.parse(fullCheck.stdout).result).toBe('blocked');
    expect(JSON.parse(fullCheck.stdout).blocking.some((finding) => finding.rule === 'no-undef')).toBe(true);

    writeFileSync(source, 'export const answer = 43;\n', 'utf8');
    git(repo, ['add', source]);
    writeFileSync(source, 'export const answer = ;\n', 'utf8');

    const stagedCheck = runCli(repo, ['check', '--ci', '--staged']);
    expect(stagedCheck.status).toBe(0);
    if (!stagedCheck.stdout) throw stagedCheck.error || new Error(`CI command produced no stdout: ${stagedCheck.stderr}`);
    expect(JSON.parse(stagedCheck.stdout).result).toBe('clean');

    writeFileSync(source, 'export const answer = missingValue;\n', 'utf8');
    git(repo, ['add', source]);
    const blocked = runCli(repo, ['check', '--ci']);
    expect(blocked.status).toBe(1);
    const output = JSON.parse(blocked.stdout);
    expect(output.result).toBe('blocked');
    expect(output.blocking.some((finding) => finding.rule === 'no-undef')).toBe(true);
  }, 120000);

  // Windows CI spawns 3+ CLI processes (init + hook execution + revoke).
  // 60s gives a comfortable margin over the ~20s Linux baseline.
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

    // On Windows, Node cannot natively execute a #!/bin/sh script.
    // We must simulate Git Bash explicitly.
    const isWin = process.platform === 'win32';
    const hookCmd = isWin ? 'bash' : hook;
    const hookArgs = isWin ? [hook] : [];

    const hookRun = spawnSync(hookCmd, hookArgs, {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}${require('path').delimiter}${process.env.PATH}`,
        CODEXA_HOOK_MARKER: originalMarker,
        CODEXA_CODEX_MARKER: join(repo, 'codexa-hook-ran'),
      },
    });
    expect(hookRun.status).toBe(0);
    expect(readFileSync(originalMarker, 'utf8')).toBe('original');
    expect(readFileSync(join(repo, 'codexa-hook-ran'), 'utf8')).toBe('codexa');

    expect(runCli(repo, ['revoke', '--yes']).status).toBe(0);
    expect(readFileSync(hook, 'utf8')).toBe(original);
  }, 60000);

  it('installs the packed CLI into a clean consumer project', async () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'codexa-package-'));
    tempRepos.push(packageDir);
    // Keep npm's cache inside the disposable test directory. This makes the
    // packaging smoke test work in read-only home-directory environments too.
    if (process.env.OFFLINE_TEST === '1') {
      console.warn(`LIVE PACKAGE SMOKE TEST: SKIPPED (offline test flag set)`);
      return;
    }
    const npmEnv = { ...process.env, npm_config_cache: join(packageDir, '.npm-cache') };
    const execOpts = { cwd: repoRoot, env: npmEnv, shell: process.platform === 'win32' };
    try {
      await execFileAsync(npm, ['pack', '--pack-destination', packageDir], execOpts);
    } catch (err) {
      // npm pack should never fail in a non-networked environment — it only reads
      // local files. If it does fail, propagate the error.
      throw new Error(`npm pack failed: ${err.message}`);
    }
    const tarball = join(packageDir, 'codexa-toolkit-1.1.3.tgz');
    const consumer = join(packageDir, 'consumer');
    mkdirSync(consumer);
    cpSync(consumerFixture, consumer, { recursive: true });
    try {
      await execFileAsync(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
        ...execOpts,
        cwd: consumer,
      });
    } catch (err) {
      if (process.env.OFFLINE_TEST === '1') {
        console.warn(`LIVE PACKAGE SMOKE TEST: SKIPPED (offline test flag set)\n${err.message}`);
        return;
      }
      throw new Error(`npm install from tarball failed: ${err.message}. If this is an offline environment, set OFFLINE_TEST=1.`);
    }
    // On Windows the shim in .bin is "codexa.cmd"; on Unix it is "codexa".
    // Windows also requires shell:true when invoking .cmd scripts via spawnSync.
    const packagedCli = join(consumer, 'node_modules', '.bin', 'codexa' + binSuffix);
    const spawnOpts = (extra = {}) => ({
      cwd: consumer,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      ...extra,
    });

    const version = spawnSync(packagedCli, ['--version'], spawnOpts());
    expect(version.status).toBe(0);
    expect(version.stdout).toContain('codexa 1.1.3');

    const help = spawnSync(packagedCli, ['--help'], spawnOpts());
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('Initialize Codexa');

    git(consumer, ['init', '-b', 'main']);
    git(consumer, ['config', 'user.email', 'consumer@example.test']);
    git(consumer, ['config', 'user.name', 'Codexa Consumer']);
    git(consumer, ['add', '.']);
    git(consumer, ['commit', '-m', 'initial']);
    const packageEnv = { ...npmEnv, CODEXA_HOME: join(packageDir, '.codexa-home') };

    const init = spawnSync(packagedCli, ['init'], spawnOpts({ env: packageEnv }));
    expect(init.status).toBe(0);

    writeFileSync(join(consumer, 'src', 'index.js'), 'export const answer = 43;\n', 'utf8');
    git(consumer, ['add', 'src/index.js']);
    const check = spawnSync(packagedCli, ['check', '--ci'], spawnOpts({ env: packageEnv }));
    expect(check.status).toBe(0);
    expect(JSON.parse(check.stdout).result).toBe('clean');
  }, 180000);
});
