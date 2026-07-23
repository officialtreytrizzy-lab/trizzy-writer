#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="${1:-$ROOT_DIR/training/config.json}"
LLAMA_CPP_DIR="${LLAMA_CPP_DIR:-}"

if [[ -z "$LLAMA_CPP_DIR" ]]; then
  echo "Set LLAMA_CPP_DIR to a current llama.cpp checkout." >&2
  exit 1
fi

readarray -t CONFIG_VALUES < <(python3 - "$CONFIG_PATH" <<'PY'
import json
import sys
from pathlib import Path
root = Path(sys.argv[1]).resolve().parents[1]
config = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
for key in ("merged_dir",):
    value = Path(config[key])
    print(value if value.is_absolute() else root / value)
PY
)

MERGED_DIR="${CONFIG_VALUES[0]}"
CONVERTER="$LLAMA_CPP_DIR/convert_hf_to_gguf.py"
QUANTIZER=""
for candidate in \
  "$LLAMA_CPP_DIR/build/bin/llama-quantize" \
  "$LLAMA_CPP_DIR/llama-quantize" \
  "$LLAMA_CPP_DIR/quantize"; do
  if [[ -x "$candidate" ]]; then
    QUANTIZER="$candidate"
    break
  fi
done

if [[ ! -d "$MERGED_DIR" ]]; then
  echo "Merged model is missing at $MERGED_DIR. Run npm run train:merge first." >&2
  exit 1
fi
if [[ ! -f "$CONVERTER" ]]; then
  echo "llama.cpp converter not found at $CONVERTER." >&2
  exit 1
fi
if [[ -z "$QUANTIZER" ]]; then
  echo "llama.cpp quantizer was not found. Build llama.cpp first." >&2
  exit 1
fi

EXPORT_DIR="$ROOT_DIR/training/exports"
mkdir -p "$EXPORT_DIR"
F16_PATH="$EXPORT_DIR/trizzy-writer-qwen3-1.7b-f16.gguf"
Q4_PATH="$EXPORT_DIR/trizzy-writer-qwen3-1.7b-q4_k_m.gguf"

python3 "$CONVERTER" "$MERGED_DIR" --outfile "$F16_PATH" --outtype f16
"$QUANTIZER" "$F16_PATH" "$Q4_PATH" Q4_K_M

python3 - "$Q4_PATH" <<'PY'
import hashlib
import json
import sys
from pathlib import Path
path = Path(sys.argv[1])
h = hashlib.sha256()
with path.open("rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        h.update(chunk)
manifest = {
    "file": str(path),
    "sizeBytes": path.stat().st_size,
    "sha256": h.hexdigest(),
    "productionActivated": False,
}
manifest_path = path.with_suffix(path.suffix + ".manifest.json")
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
PY

echo
printf 'GGUF export completed at %s\n' "$Q4_PATH"
echo "The production model was not replaced. Activate it only after a final smoke test."
