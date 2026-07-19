#!/usr/bin/env bash
set -euo pipefail

# npm injects a stale prefix into lifecycle scripts on Lightning Studios.
unset npm_config_prefix NPM_CONFIG_PREFIX
NODE_BIN="$(dirname "$(command -v node)")"
export PATH="$NODE_BIN:$PATH"


ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="$ROOT_DIR/models"
MODEL_PATH="$MODEL_DIR/qwen3-1.7b-q4.gguf"
RUNTIME_DIR="$ROOT_DIR/.runtime"
OLLAMA_MODEL="qwen3:1.7b"

mkdir -p "$MODEL_DIR" "$RUNTIME_DIR"
cd "$ROOT_DIR"

echo "Installing Node dependencies..."
npm install

echo "Installing the CPU-safe OpenAI-compatible model server..."
python3 -m pip install \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu \
  "llama-cpp-python[server]==0.3.34"

if [[ ! -s "$MODEL_PATH" ]]; then
  if ! command -v ollama >/dev/null 2>&1; then
    echo "Installing Ollama only as a model downloader..."
    curl -fsSL https://ollama.com/install.sh | sh
  fi

  sudo systemctl start ollama >/dev/null 2>&1 || true
  echo "Downloading $OLLAMA_MODEL..."
  ollama pull "$OLLAMA_MODEL"

  MODEL_BLOB="$(ollama show "$OLLAMA_MODEL" --modelfile | sed -n 's/^FROM //p' | head -n 1)"
  if [[ -z "$MODEL_BLOB" ]] || ! sudo test -f "$MODEL_BLOB"; then
    echo "Could not resolve the downloaded GGUF model path." >&2
    exit 1
  fi

  echo "Copying the GGUF model into persistent Studio storage..."
  sudo cp "$MODEL_BLOB" "$MODEL_PATH"
  sudo chown "$(id -u):$(id -g)" "$MODEL_PATH"
fi

sudo systemctl stop ollama >/dev/null 2>&1 || true

if [[ ! -f .env.local ]]; then
  cp .env.lightning.example .env.local
fi

echo "Building Trizzy Writer..."
npm run build

echo
echo "Setup complete. Start the app with:"
echo "  npm run lightning:start"
