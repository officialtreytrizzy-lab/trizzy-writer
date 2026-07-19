#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LLAMA_PORT="${TRIZZY_LLAMA_PORT:-8000}"
APP_PORT="${PORT:-3000}"

echo "CPU and memory:"
getconf _NPROCESSORS_ONLN 2>/dev/null || true
free -h || true

echo
echo "CPU model server:"
if curl -fsS "http://127.0.0.1:${LLAMA_PORT}/v1/models"; then
  echo
else
  echo "offline"
  tail -n 30 "$RUNTIME_DIR/llama-cpp.log" 2>/dev/null || true
fi

echo
echo "Trizzy Writer:"
if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health"; then
  echo
else
  echo "offline"
  tail -n 30 "$RUNTIME_DIR/trizzy-writer.log" 2>/dev/null || true
fi
