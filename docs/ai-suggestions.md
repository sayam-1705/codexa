# AI Suggestions

Codexa can suggest fixes through Ollama running locally.

## Requirements

- Ollama installed
- A local model pulled
- Ollama service running on localhost:11434

## Setup

```bash
ollama serve
ollama pull deepseek-coder:6.7b
```

## Model Selection

Codexa checks available models and prefers code-oriented models in this order:

1. deepseek-coder:6.7b
2. codellama:7b
3. llama3:8b
4. first available model containing "code"

## Caching

Codexa caches AI suggestions by context fingerprint in `.codexa/cache.json` to reduce repeated latency. Cache hits are returned instantly and do not call Ollama.

## Troubleshooting

- Cannot connect:

```bash
ollama serve
curl http://localhost:11434/api/tags
```

- Model missing:

```bash
ollama list
ollama pull deepseek-coder:6.7b
```

- Slow responses:

Use a smaller model and keep prompt scope narrow.
