import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { relative, resolve } from 'path';

function normalizedMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim();
}

export function fingerprintFinding(finding, repoPath) {
  // Primary v2 fingerprint must be resilient to line movement and other volatile formatting changes.
  const file = String(finding.file || '').replace(/\\/g, '/');
  const relativeFile = relative(repoPath, file).replace(/\\/g, '/');
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
  const relativeFile = relative(repoPath, file).replace(/\\/g, '/');
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
  const relativeFile = relative(repoPath, file).replace(/\\/g, '/');
  const identity = [relativeFile, finding.rule, finding.code || '', normalizedMessage(finding.message)].join('\0');
  return createHash('sha256').update(identity).digest('hex');
}

function baselinePath(repoPath) {
  return resolve(repoPath, '.codexa', 'baseline.json');
}

export function loadBaseline(repoPath) {
  const path = baselinePath(repoPath);
  if (!existsSync(path)) return null;
  
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Corrupted baseline file: ${path}. ${err.message}`);
  }
  
  if (!data || !Array.isArray(data.fingerprints)) {
    throw new Error('Invalid Codexa baseline: fingerprints must be an array.');
  }
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
  
  const preexisting = [...classified.preexisting];
  
  const filterAndMove = findings => findings.filter(finding => {
    if (isBaselineFinding(finding)) {
      preexisting.push(finding);
      return false;
    }
    return true;
  });

  const blocking = filterAndMove(classified.blocking);
  
  // We keep warnings and minor in their respective categories to not lose historical info,
  // but we can optionally add them to preexisting if they match the baseline.
  // The simplest fix to not lose them is to NOT filter them out.
  const warnings = classified.warnings.map(finding => {
    if (isBaselineFinding(finding)) preexisting.push(finding);
    return finding;
  });
  
  const minor = classified.minor.map(finding => {
    if (isBaselineFinding(finding)) preexisting.push(finding);
    return finding;
  });

  return {
    ...classified,
    blocking,
    warnings,
    minor,
    preexisting,
  };
}

export function getBaselineVersion(repoPath) {
  const path = baselinePath(repoPath);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return data.version ?? 1;
}