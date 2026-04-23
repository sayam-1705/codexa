import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';

// Database file at ~/.codexa/history.db
const DB_PATH = path.join(os.homedir(), '.codexa', 'history.db');

let dbInstance = null;

/**
 * Get or create the SQLite database connection.
 * Initializes schema on first run.
 */
export function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');

  initializeSchema(dbInstance);
  return dbInstance;
}

/**
 * Close database connection.
 */
export function closeDb(db) {
  if (db) {
    db.close();
    if (dbInstance === db) {
      dbInstance = null;
    }
  }
}

/**
 * Initialize database schema on first run.
 * Creates tables: runs, errors_log, meta
 */
function initializeSchema(db) {
  // Check if schema is already initialized
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='runs'")
    .all();

  if (tables.length > 0) {
    return; // Already initialized
  }

  // Create runs table
  db.exec(`
    CREATE TABLE runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      repo_path TEXT NOT NULL,
      language TEXT,
      files_checked INTEGER DEFAULT 0,
      errors_found INTEGER DEFAULT 0,
      errors_blocked INTEGER DEFAULT 0,
      fixes_accepted INTEGER DEFAULT 0,
      ai_queries INTEGER DEFAULT 0,
      pattern_hits INTEGER DEFAULT 0,
      commit_allowed INTEGER DEFAULT 0,
      force_commit INTEGER DEFAULT 0,
      branch TEXT,
      duration_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE errors_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      file TEXT NOT NULL,
      line INTEGER,
      rule TEXT NOT NULL,
      severity TEXT,
      language TEXT,
      blame_category TEXT,
      was_fixed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE TABLE meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX idx_runs_timestamp ON runs(timestamp);
    CREATE INDEX idx_runs_repo ON runs(repo_path);
    CREATE INDEX idx_errors_rule ON errors_log(rule);
    CREATE INDEX idx_errors_run_id ON errors_log(run_id);
  `);

  // Initialize meta table
  db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run(
    'schema_version',
    '1'
  );
}

/**
 * Log a linting run to the database.
 * @param {Object} runData - Run data to log
 * @returns {number} - Insert ID (run_id)
 */
export function logRun(db, runData) {
  const {
    timestamp,
    repoPath,
    language,
    filesChecked,
    errorsFound,
    errorsBlocked,
    fixesAccepted = 0,
    aiQueries = 0,
    patternHits = 0,
    commitAllowed,
    forceCommit = 0,
    branch,
    durationMs = 0,
    errors = [],
  } = runData;

  // Insert run
  const stmt = db.prepare(`
    INSERT INTO runs (
      timestamp, repo_path, language, files_checked, errors_found,
      errors_blocked, fixes_accepted, ai_queries, pattern_hits,
      commit_allowed, force_commit, branch, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    timestamp,
    repoPath,
    language,
    filesChecked,
    errorsFound,
    errorsBlocked,
    fixesAccepted,
    aiQueries,
    patternHits,
    commitAllowed ? 1 : 0,
    forceCommit ? 1 : 0,
    branch,
    durationMs
  );

  const runId = result.lastInsertRowid;

  // Insert errors
  if (errors && errors.length > 0) {
    const errorStmt = db.prepare(`
      INSERT INTO errors_log (
        run_id, file, line, rule, severity, language,
        blame_category, was_fixed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const error of errors) {
      errorStmt.run(
        runId,
        error.file || '',
        error.line || 0,
        error.rule || '',
        error.severity || '',
        error.language || '',
        error.blameCategory || '',
        error.wasFixed ? 1 : 0
      );
    }
  }

  return runId;
}

/**
 * Get recent runs for a repository.
 * @param {Object} db - Database connection
 * @param {number} limit - Number of runs to return
 * @param {string} repoPath - Repository path (optional, all if omitted)
 * @returns {Array} - Array of run objects
 */
export function getRecentRuns(db, limit = 50, repoPath = null) {
  let query = 'SELECT * FROM runs';
  const params = [];

  if (repoPath) {
    query += ' WHERE repo_path = ?';
    params.push(repoPath);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params);
}

/**
 * Get error frequency by rule over a time period.
 * @param {Object} db - Database connection
 * @param {string} repoPath - Repository path
 * @param {number} days - Look back N days
 * @returns {Array} - Array of {rule, count, severity} sorted by frequency
 */
export function getErrorFrequency(db, repoPath, days = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const query = `
    SELECT
      el.rule,
      el.severity,
      COUNT(*) as count
    FROM errors_log el
    JOIN runs r ON el.run_id = r.id
    WHERE r.repo_path = ? AND r.timestamp >= ?
    GROUP BY el.rule, el.severity
    ORDER BY count DESC
  `;

  return db.prepare(query).all(repoPath, cutoffDate);
}

/**
 * Get daily error counts over a time period.
 * @param {Object} db - Database connection
 * @param {string} repoPath - Repository path
 * @param {number} days - Look back N days
 * @returns {Array} - Array of {date, count} objects
 */
export function getDailyErrorCounts(db, repoPath, days = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const query = `
    SELECT
      DATE(r.timestamp) as date,
      COUNT(el.id) as count,
      SUM(CASE WHEN el.severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count
    FROM runs r
    LEFT JOIN errors_log el ON r.id = el.run_id
    WHERE r.repo_path = ? AND r.timestamp >= ?
    GROUP BY DATE(r.timestamp)
    ORDER BY date DESC
  `;

  return db.prepare(query).all(repoPath, cutoffDate);
}

/**
 * Get lifetime statistics for a repository.
 * @param {Object} db - Database connection
 * @param {string} repoPath - Repository path
 * @returns {Object} - Aggregate stats
 */
export function getLifetimeStats(db, repoPath) {
  const query = `
    SELECT
      COUNT(r.id) as total_runs,
      SUM(r.errors_found) as total_errors_found,
      SUM(r.errors_blocked) as total_errors_blocked,
      SUM(r.fixes_accepted) as total_fixes_accepted,
      SUM(r.ai_queries) as total_ai_queries,
      SUM(r.pattern_hits) as total_pattern_hits,
      SUM(CASE WHEN r.commit_allowed = 1 THEN 1 ELSE 0 END) as successful_commits,
      SUM(CASE WHEN r.force_commit = 1 THEN 1 ELSE 0 END) as forced_commits,
      AVG(r.duration_ms) as avg_duration_ms,
      MIN(r.timestamp) as first_run,
      MAX(r.timestamp) as last_run
    FROM runs r
    WHERE r.repo_path = ?
  `;

  const result = db.prepare(query).get(repoPath);
  return result || {};
}

/**
 * Update run stats after fixes are accepted or AI queries made.
 * @param {Object} db - Database connection
 * @param {number} runId - Run ID to update
 * @param {Object} updates - {fixesAccepted, aiQueries, patternHits}
 */
export function updateRunStats(db, runId, updates) {
  const { fixesAccepted, aiQueries, patternHits } = updates;

  const stmt = db.prepare(`
    UPDATE runs
    SET fixes_accepted = COALESCE(?, fixes_accepted),
        ai_queries = COALESCE(?, ai_queries),
        pattern_hits = COALESCE(?, pattern_hits)
    WHERE id = ?
  `);

  stmt.run(fixesAccepted ?? null, aiQueries ?? null, patternHits ?? null, runId);
}

/**
 * Get meta value (e.g., last_digest_shown_at).
 * @param {Object} db - Database connection
 * @param {string} key - Meta key
 * @returns {string|null} - Meta value or null
 */
export function getMeta(db, key) {
  const result = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return result ? result.value : null;
}

/**
 * Set meta value.
 * @param {Object} db - Database connection
 * @param {string} key - Meta key
 * @param {string} value - Meta value
 */
export function setMeta(db, key, value) {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
    key,
    value
  );
}
