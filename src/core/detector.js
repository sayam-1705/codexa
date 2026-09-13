import { getEnabledAdapters } from '../plugins/registry.js';
import { discoverSupportedFiles } from './files.js';
import { extname } from 'path';

export async function detectLanguages(repoPath) {
  try {
    // Load all enabled adapters from registry
    const adapters = await getEnabledAdapters(repoPath);
    let files = [];
    try {
      files = await discoverSupportedFiles(repoPath, {});
    } catch {
      // Adapter detection also supports paths that are not Git repositories.
    }
    const extensions = new Set(files.map(file => extname(file)));

    if (adapters.length === 0) {
      return [];
    }

    // Run all detect() calls in parallel
    const detectPromises = adapters.map((adapter) => adapter.detect(repoPath));
    const results = await Promise.all(detectPromises);

    // Map adapters to their language names if detect returned true
    const detected = adapters
      .map((adapter, index) => (
        results[index] || adapter.extensions.some(extension => extensions.has(extension))
          ? adapter.language
          : null
      ))
      .filter(Boolean);

    return detected;
  } catch (err) {
    // Return empty array on error (adapters are already wrapped)
    return [];
  }
}
