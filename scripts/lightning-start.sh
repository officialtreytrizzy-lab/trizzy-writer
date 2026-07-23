#!/usr/bin/env bash
set -euo pipefail

# npm injects a stale prefix into lifecycle scripts on Lightning Studios.
unset npm_config_prefix NPM_CONFIG_PREFIX
NODE_BIN="$(dirname "$(command -v node)")"
export PATH="$NODE_BIN:$PATH"


ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_PATH="${TRIZZY_GGUF_MODEL_PATH:-$ROOT_DIR/models/qwen3-1.7b-q4.gguf}"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LLAMA_PORT="${TRIZZY_LLAMA_PORT:-8000}"
APP_PORT="${PORT:-3000}"
THREADS="${TRIZZY_LLAMA_THREADS:-4}"
CONTEXT="${TRIZZY_LLAMA_CONTEXT:-8192}"
BATCH="${TRIZZY_LLAMA_BATCH:-128}"

mkdir -p "$RUNTIME_DIR"
cd "$ROOT_DIR"

if [[ ! -s "$MODEL_PATH" ]]; then
  echo "Model file is missing at $MODEL_PATH." >&2
  echo "Run npm run lightning:setup first." >&2
  exit 1
fi

if [[ ! -f .env.local ]]; then
  cp .env.lightning.example .env.local
fi

pkill -f "llama_cpp.server" >/dev/null 2>&1 || true
pkill -f "next start" >/dev/null 2>&1 || true

nohup python3 -m llama_cpp.server \
  --model "$MODEL_PATH" \
  --model_alias trizzy-writer \
  --host 127.0.0.1 \
  --port "$LLAMA_PORT" \
  --n_ctx "$CONTEXT" \
  --n_threads "$THREADS" \
  --n_batch "$BATCH" \
  --chat_template_kwargs '{"enable_thinking": false}' \
  > "$RUNTIME_DIR/llama-cpp.log" 2>&1 &
echo $! > "$RUNTIME_DIR/llama-cpp.pid"

for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${LLAMA_PORT}/v1/models" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:${LLAMA_PORT}/v1/models" >/dev/null 2>&1; then
  echo "The CPU model server failed to start." >&2
  tail -n 80 "$RUNTIME_DIR/llama-cpp.log" >&2 || true
  exit 1
fi

if [[ ! -d .next ]]; then
  npm run build
fi

nohup npx next start --hostname 0.0.0.0 --port "$APP_PORT" \
  > "$RUNTIME_DIR/trizzy-writer.log" 2>&1 &
echo $! > "$RUNTIME_DIR/trizzy-writer.pid"

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:${APP_PORT}/api/health"; then
  echo >&2
  echo "Trizzy Writer failed to start." >&2
  tail -n 80 "$RUNTIME_DIR/trizzy-writer.log" >&2 || true
  exit 1
fi

echo
echo "Trizzy Writer is running on port $APP_PORT."
echo "Open the Lightning Port Viewer and select Trizzy Writer."
