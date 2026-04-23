import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ollama from '../src/ai/ollama.js';

describe('Ollama Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when Ollama is unavailable', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));

    const result = await ollama.isOllamaAvailable();
    expect(result).toBe(false);
  });

  it('should return true when Ollama responds with 200', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const result = await ollama.isOllamaAvailable();
    expect(result).toBe(true);
  });

  it('should return empty array on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const result = await ollama.getAvailableModels();
    expect(result).toEqual([]);
  });

  it('should return model names on success', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'deepseek-coder:6.7b' },
          { name: 'codellama:7b' },
        ],
      }),
    });

    const result = await ollama.getAvailableModels();
    expect(result).toEqual(['deepseek-coder:6.7b', 'codellama:7b']);
  });

  it('should select best model from available list', async () => {
    const models = ['llama3:8b', 'deepseek-coder:6.7b'];
    const selected = await ollama.selectBestModel(models);
    expect(selected).toBe('deepseek-coder:6.7b');
  });

  it('should fall back to codellama if deepseek unavailable', async () => {
    const models = ['llama3:8b', 'codellama:7b'];
    const selected = await ollama.selectBestModel(models);
    expect(selected).toBe('codellama:7b');
  });

  it('should return first available model if no preference match', async () => {
    const models = ['custom-model:1.0'];
    const selected = await ollama.selectBestModel(models);
    expect(selected).toBe('custom-model:1.0');
  });

  it('should return null if no models available', async () => {
    const selected = await ollama.selectBestModel([]);
    expect(selected).toBeNull();
  });

  it('should handle error gracefully in streaming', () => {
    return new Promise((resolve, reject) => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Stream error'));

      ollama.streamSuggestion(
        'test',
        'deepseek-coder:6.7b',
        () => {},
        () => {
          reject(new Error('Should have called onError'));
        },
        (err) => {
          expect(err.message).toBe('Stream error');
          resolve();
        }
      );
    });
  });
});
