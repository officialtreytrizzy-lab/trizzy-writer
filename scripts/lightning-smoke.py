from __future__ import annotations

import json
import sys
import time
import urllib.request

BASE_URL = "http://127.0.0.1:3000"

payload = {
    "mode": "hook-lab",
    "prompt": "Write a four-line Trap R&B hook about choosing peace over mixed signals.",
    "sourceLyrics": "",
    "lockedLyrics": "",
    "maxCharacters": 700,
    "creativity": 0.7,
    "contentLevel": "explicit",
}

request = urllib.request.Request(
    f"{BASE_URL}/api/generate",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

started = time.perf_counter()
with urllib.request.urlopen(request, timeout=180) as response:
    data = json.loads(response.read().decode("utf-8"))
elapsed = time.perf_counter() - started

text = str(data.get("text", "")).strip()
if not text:
    raise RuntimeError(f"Generation returned no text: {data}")
if "<think>" in text.lower() or "</think>" in text.lower():
    raise RuntimeError(f"Reasoning leaked into the response: {text}")
if len(text) > payload["maxCharacters"]:
    raise RuntimeError(f"Response exceeded the character limit: {len(text)}")

print(
    json.dumps(
        {
            "ok": True,
            "seconds": round(elapsed, 2),
            "model": data.get("model"),
            "provider": data.get("provider"),
            "characters": len(text),
            "text": text,
        },
        indent=2,
    )
)
