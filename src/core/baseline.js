import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';

function normalizedMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim();
}

export function fingerprintFinding(finding, repoPath) {
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
  writeFileSync(path, `${JSON.stringify({ version: 1, fingerprints }, null, 2)}\n`, 'utf8');
  return path;
}

export function filterBaselineFindings(classified, repoPath, baseline) {
  if (!baseline) return classified;
  const filter = findings => findings.filter(finding => !baseline.has(fingerprintFinding(finding, repoPath)));
  return {
    ...classified,
    blocking: filter(classified.blocking),
    warnings: filter(classified.warnings),
    minor: filter(classified.minor),
    preexisting: [...classified.preexisting, ...classified.blocking.filter(finding => baseline.has(fingerprintFinding(finding, repoPath)))],
  };
}