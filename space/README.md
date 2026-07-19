---
title: Trizzy Writer CPU API
emoji: 🎙️
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
---

# Trizzy Writer CPU API

This directory is a standalone Hugging Face Docker Space for the Trizzy Writer model endpoint. Copy the contents of `space/` into the root of a new Docker Space.

## Default model

```text
Repository: Qwen/Qwen3-1.7B-GGUF
File: Qwen3-1.7B-Q8_0.gguf
Context: 4096 tokens
Concurrent generations: 1
```

The model downloads lazily on the first generation request. The first request after a Space rebuild or sleep will therefore take longer.

## Space variables

Optional variables:

```text
HF_MODEL_REPO=Qwen/Qwen3-1.7B-GGUF
HF_MODEL_FILE=Qwen3-1.7B-Q8_0.gguf
TRIZZY_MODEL_NAME=trizzy-writer
N_CTX=4096
N_THREADS=1
N_BATCH=128
```

Leave `N_THREADS` unset to use all available CPU cores except one.

## Space secrets

Create this secret in the Space Settings page:

```text
TRIZZY_SPACE_API_KEY=use-a-long-random-secret
```

When set, every chat-completion request must contain:

```text
Authorization: Bearer use-a-long-random-secret
```

For a private or gated model repository, also add:

```text
HF_TOKEN=your-read-token
```

## Connect the Next.js app

Set these server-side variables in the Trizzy Writer application:

```text
TRIZZY_MODEL_PROVIDER=openai-compatible
TRIZZY_MODEL_API_URL=https://YOUR-SPACE-NAME.hf.space
TRIZZY_MODEL_API_TOKEN=the-same-value-as-TRIZZY_SPACE_API_KEY
TRIZZY_MODEL_NAME=trizzy-writer
```

Do not prefix the API token with `NEXT_PUBLIC_`.

## Endpoints

```text
GET  /
GET  /health
POST /v1/chat/completions
```

The chat route is compatible with the non-streaming OpenAI chat-completions response shape used by the Trizzy Writer Next.js backend.

## CPU expectations

Free CPU inference is deliberately conservative:

- One generation runs at a time.
- Long songs can take several minutes.
- The Space can sleep when inactive.
- The first request may need to download and load the model.
- Larger models or longer context settings can exceed free memory or become impractically slow.
