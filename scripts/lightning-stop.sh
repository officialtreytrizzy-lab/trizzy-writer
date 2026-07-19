#!/usr/bin/env bash
set -euo pipefail

pkill -f "llama_cpp.server" >/dev/null 2>&1 || true
pkill -f "next start" >/dev/null 2>&1 || true

echo "Stopped Trizzy Writer and the CPU model server."
