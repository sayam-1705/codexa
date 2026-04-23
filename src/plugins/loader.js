/**
 * Dynamic adapter loader with error wrapping
 * A crashing community adapter must never crash Codexa
 * All three methods are wrapped in try-catch with safe fallbacks
 */

import { validateAdapter } from './interface.js';

/**
 * Load an adapter module and wrap all methods with error handling
 * @param {string} packageNameOrPath - 'builtin:javascript', 'codexa-adapter-go', or file path
 * @returns {Promise<Object>} - Wrapped adapter with safe error handling
 * @throws {Error} - If adapter fails validation
 */
export async function loadAdapter(packageNameOrPath) {
  let adapterModule;

  // Handle built-in adapters
  if (packageNameOrPath === 'builtin:javascript') {
    const { default: adapter } = await import('./adapters/javascript.js');
    adapterModule = adapter;
  } else if (packageNameOrPath === 'builtin:python') {
    const { default: adapter } = await import('./adapters/python.js');
    adapterModule = adapter;
  } else {
    // Dynamic import of community adapter npm package
    try {
      const module = await import(packageNameOrPath);
      adapterModule = module.default || module;
    } catch (err) {
      throw new Error(
        `Failed to load adapter '${packageNameOrPath}': ${err.message}`
      );
    }
  }

  // Validate the loaded adapter
  const validation = validateAdapter(adapterModule);
  if (!validation.valid) {
    const errMsg = validation.errors.join('; ');
    throw new Error(`Adapter validation failed: ${errMsg}`);
  }

  // Wrap detect() with 500ms timeout and error handling
  const originalDetect = adapterModule.detect;
  const wrappedDetect = async (repoPath) => {
    try {
      return await Promise.race([
        originalDetect(repoPath),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Adapter detect() exceeded 500ms timeout')),
            500
          )
        ),
      ]);
    } catch (err) {
      console.error(
        `[${adapterModule.name || 'unknown'}] detect() error:`,
        err.message
      );
      return false;
    }
  };

  // Wrap lint() with error handling
  const originalLint = adapterModule.lint;
  const wrappedLint = async (files, config) => {
    try {
      return await originalLint(files, config);
    } catch (err) {
      console.error(
        `[${adapterModule.name || 'unknown'}] lint() error:`,
        err.message
      );
      return [];
    }
  };

  // Wrap fix() with error handling
  const originalFix = adapterModule.fix;
  const wrappedFix = async (file, rule, config) => {
    try {
      return await originalFix(file, rule, config);
    } catch (err) {
      console.error(
        `[${adapterModule.name || 'unknown'}] fix() error:`,
        err.message
      );
      return {
        success: false,
        diff: null,
        message: `Adapter error: ${err.message}`,
      };
    }
  };

  // Return adapter with wrapped methods but original metadata
  return {
    ...adapterModule,
    detect: wrappedDetect,
    lint: wrappedLint,
    fix: wrappedFix,
  };
}
