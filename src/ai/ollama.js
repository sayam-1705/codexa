/**
 * Ollama HTTP client for local LLM inference
 * Communicates with Ollama at http://localhost:11434
 */

const OLLAMA_BASE = 'http://localhost:11434';
const TIMEOUT_MS = 2000;
const STREAM_TIMEOUT = 30000;

function getOllamaFixMessage() {
  return (
    `Cannot connect to Ollama at ${OLLAMA_BASE}.\n` +
    'Fix: start Ollama with "ollama serve", then pull a model (for example: ollama pull deepseek-coder:6.7b).'
  );
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: controller.signal,
      timeout: TIMEOUT_MS,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Get list of available models from Ollama
 */
export async function getAvailableModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      timeout: TIMEOUT_MS,
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.models || []).map((m) => m.name);
  } catch (err) {
    return [];
  }
}

/**
 * Select the best available model for code generation
 */
export async function selectBestModel(availableModels) {
  const preference = ['deepseek-coder:6.7b', 'codellama:7b', 'llama3:8b', "deepseek-coder"];

  // Check preferred models in order
  for (const model of preference) {
    if (availableModels.includes(model)) {
      return model;
    }
  }

  // Look for any model with 'code' in the name
  const codeModel = availableModels.find((m) => m.toLowerCase().includes('code'));
  if (codeModel) return codeModel;

  // Return first available
  return availableModels[0] || null;
}

/**
 * Stream a suggestion from Ollama
 * Calls onToken for each chunk, onDone when complete, onError on failure
 * Returns AbortController for cancellation
 */
export function streamSuggestion(
  prompt,
  model,
  onToken,
  onDone,
  onError
) {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Ollama returned HTTP ${response.status}: ${response.statusText}.\n` +
          'Fix: verify the model name exists (ollama list) and retry the request.'
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const chunk = JSON.parse(line);
              if (chunk.response) {
                onToken(chunk.response);
              }
            } catch (e) {
              // Ignore parse errors, continue
            }
          }
        }

        // Keep incomplete line in buffer
        buffer = lines[lines.length - 1];
      }

      // Process any remaining data
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer);
          if (chunk.response) {
            onToken(chunk.response);
          }
        } catch (e) {
          // Ignore
        }
      }

      onDone();
    } catch (err) {
      if (err.name === 'AbortError') {
        // Cancelled, don't call error handler
        return;
      }
      onError(err);
    }
  })();

  return controller;
}

/**
 * Get suggestion without streaming (blocking)
 */
export async function getSuggestion(prompt, model) {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
      timeout: STREAM_TIMEOUT,
    });

    if (!response.ok) {
      throw new Error(
        `Ollama returned HTTP ${response.status}: ${response.statusText}.\n` +
        'Fix: verify Ollama is running and the selected model is available via ollama list.'
      );
    }

    const data = await response.json();
    return data.response || '';
  } catch (err) {
    throw new Error(`${err.message}\n${getOllamaFixMessage()}`);
  }
}
