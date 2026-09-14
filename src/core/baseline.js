import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';

function normalizedMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim();
}

export function fingerprintFinding(finding, repoPath) {
  // Primary v2 fingerprint must be resilient to line movement and other volatile formatting changes.
  const file = String(finding.file || '').replace(/\\/g, '/');
  const relativeFile = file.startsWith(`${repoPath}/`) ? file.slice(repoPath.length + 1) : file;
  const identity = [
    relativeFile,
    finding.rule,
    finding.code || '',
    normalizedMessage(finding.message),
  ].join('\0');
  return createHash('sha256').update(identity).digest('hex');
}

function fingerprintWithLine(finding, repoPath) {
  const file = String(finding.file || '').replace(/\\/g, '/');
  const relativeFile = file.startsWith(`${repoPath}/`) ? file.slice(repoPath.length + 1) : file;
  const identity = [
    relativeFile,
    finding.line || 0,
    finding.rule,
    finding.code || '',
    normalizedMessage(finding.message),
  ].join('\0');
  return createHash('sha256').update(identity).digest('hex');
}

function legacyFingerprint(finding, repoPath) {
  const file = String(finding.file || '').replace(/\\/g, '/');
  const relativeFile = file.startsWith(`${repoPath}/`) ? file.slice(repoPath.length + 1) : file;
  const identity = [relativeFile, finding.rule, finding.code || '', normalizedMessage(finding.message)].join('\0');
  return createHash('sha256').update(identity).digest('hex');
}

function baselinePath(repoPath) {
  return resolve(repoPath, '.codexa', 'baseline.json');
}

export function loadBaseline(repoPath) {
  const path = baselinePath(repoPath);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(data.fingerprints)) throw new Error('Invalid Codexa baseline: fingerprints must be an array.');
  return new Set(data.fingerprints);
}

export function saveBaseline(repoPath, findings) {
  const path = baselinePath(repoPath);
  mkdirSync(resolve(repoPath, '.codexa'), { recursive: true });
  const fingerprints = [...new Set(findings.map(finding => fingerprintFinding(finding, repoPath)))].sort();
  writeFileSync(path, `${JSON.stringify({ version: 2, fingerprints }, null, 2)}\n`, 'utf8');
  return path;
}

export function filterBaselineFindings(classified, repoPath, baseline) {
  if (!baseline) return classified;
  const isBaselineFinding = finding =>
    baseline.has(fingerprintFinding(finding, repoPath)) ||
    baseline.has(fingerprintWithLine(finding, repoPath)) ||
    baseline.has(legacyFingerprint(finding, repoPath));
  const filter = findings => findings.filter(finding => !isBaselineFinding(finding));
  return {
    ...classified,
    blocking: filter(classified.blocking),
    warnings: filter(classified.warnings),
    minor: filter(classified.minor),
    preexisting: [...classified.preexisting, ...classified.blocking.filter(isBaselineFinding)],
  };
}

export function getBaselineVersion(repoPath) {
  const path = baselinePath(repoPath);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return data.version ?? 1;
}