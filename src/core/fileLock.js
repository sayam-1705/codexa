import { mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';

export function withFileLock(filePath, callback, timeoutMs = 5000) {
  const lockPath = `${resolve(filePath)}.lock`;
  const started = Date.now();
  const waitBuffer = new Int32Array(new SharedArrayBuffer(4));

  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() - started >= timeoutMs) {
        throw new Error(`Could not acquire analytics lock: ${error.message}`);
      }
      Atomics.wait(waitBuffer, 0, 0, 10);
    }
  }

  try {
    return callback();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}