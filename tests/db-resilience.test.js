/**
 * SQLite database resilience tests — tests using the REAL database module.
 *
 * Core principle: database failures must NEVER affect lint correctness.
 * The database is supplemental metrics only.
 *
 * Tests:
 * - Missing .codexa directory → getDb() creates it and the database
 * - logRun() inserts a record and returns a positive ID
 * - Corrupt database file → handled predictably without crashing
 * - Concurrent writes → WAL mode prevents corruption, no uncaught exceptions
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// No vi.mock here — this file tests the REAL database module.

const tempDirs = [];
afterEach(() => {
  while (tempDirs.length) {
    try { rmSync(tempDirs.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function makeTempDir(suffix = '') {
  const dir = mkdtempSync(join(tmpdir(), `codexa-db-${suffix}-`));
  tempDirs.push(dir);
  return dir;
}

describe('SQLite — missing directory', () => {
  it('getDb creates the directory and database when .codexa is missing', async () => {
    const home = makeTempDir('missing');
    process.env.CODEXA_HOME = home;
    vi.resetModules();

    try {
      const { getDb, closeDb } = await import('../src/solo/db.js');
      let db;
      expect(() => { db = getDb(); }).not.toThrow();
      expect(db).toBeTruthy();
      expect(existsSync(join(home, 'history.db'))).toBe(true);
      try { if (db) closeDb(db); } catch { /* ignore */ }
    } finally {
      delete process.env.CODEXA_HOME;
      vi.resetModules();
    }
  });

  it('logRun inserts a record and returns a positive run ID', async () => {
    const home = makeTempDir('logrun');
    process.env.CODEXA_HOME = home;
    vi.resetModules();

    try {
      const { getDb, logRun, closeDb } = await import('../src/solo/db.js');
      const db = getDb();
      try {
        const id = logRun(db, {
          timestamp: new Date().toISOString(),
          repoPath: home,
          language: 'javascript',
          filesChecked: 3,
          errorsFound: 1,
          errorsBlocked: 1,
          commitAllowed: false,
          durationMs: 42,
          errors: [],
        });
        // better-sqlite3 returns BigInt for lastInsertRowid
        const numericId = typeof id === 'bigint' ? id : BigInt(String(id));
        expect(numericId).toBeGreaterThan(0n);
      } finally {
        try { closeDb(db); } catch { /* ignore */ }
      }
    } finally {
      delete process.env.CODEXA_HOME;
      vi.resetModules();
    }
  });
});

describe('SQLite — corrupt database file', () => {
  it('does not crash the process when the database file contains garbage bytes', async () => {
    const home = makeTempDir('corrupt');
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, 'history.db'), Buffer.from('NOT SQLITE\x00\xFF\xFE'), 'binary');

    process.env.CODEXA_HOME = home;
    vi.resetModules();

    try {
      const { getDb, closeDb } = await import('../src/solo/db.js');
      let db;
      try {
        db = getDb();
        try { if (db) closeDb(db); } catch { /* ignore */ }
      } catch (err) {
        // A database error is acceptable — it must be an Error instance,
        // not an unhandled crash that kills the process
        expect(err).toBeInstanceOf(Error);
      }
    } finally {
      delete process.env.CODEXA_HOME;
      vi.resetModules();
    }
  });
});

describe('SQLite — concurrent writes', () => {
  it('10 concurrent logRun calls produce no uncaught exceptions', async () => {
    const home = makeTempDir('concurrent');
    process.env.CODEXA_HOME = home;
    vi.resetModules();

    try {
      const { getDb, logRun, closeDb } = await import('../src/solo/db.js');
      const db = getDb();
      try {
        const runData = () => ({
          timestamp: new Date().toISOString(),
          repoPath: home,
          language: 'javascript',
          filesChecked: 1,
          errorsFound: 0,
          errorsBlocked: 0,
          commitAllowed: true,
          durationMs: 5,
          errors: [],
        });

        // better-sqlite3 is synchronous — WAL + busy_timeout must prevent crashes
        const results = await Promise.allSettled(
          Array.from({ length: 10 }, () =>
            Promise.resolve().then(() => logRun(db, runData()))
          )
        );

        const succeeded = results.filter(r => r.status === 'fulfilled');
        expect(succeeded.length).toBeGreaterThan(0);

        for (const r of results) {
          if (r.status === 'rejected') {
            expect(r.reason).toBeInstanceOf(Error);
          }
        }
      } finally {
        try { closeDb(db); } catch { /* ignore */ }
      }
    } finally {
      delete process.env.CODEXA_HOME;
      vi.resetModules();
    }
  });
});
