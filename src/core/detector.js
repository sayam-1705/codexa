import { getEnabledAdapters } from '../plugins/registry.js';

export async function detectLanguages(repoPath) {
  try {
    // Load all enabled adapters from registry
    const adapters = await getEnabledAdapters(repoPath);

    if (adapters.length === 0) {
      return [];
    }

    // Run all detect() calls in parallel
    const detectPromises = adapters.map((adapter) => adapter.detect(repoPath));
    const results = await Promise.all(detectPromises);

    // Map adapters to their language names if detect returned true
    const detected = adapters
      .map((adapter, index) => (results[index] ? adapter.language : null))
      .filter(Boolean);

    return detected;
  } catch (err) {
    // Return empty array on error (adapters are already wrapped)
    return [];
  }
}
