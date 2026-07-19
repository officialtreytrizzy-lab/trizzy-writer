from __future__ import annotations

import asyncio
import os
import threading
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from llama_cpp import Llama
from pydantic import BaseModel, Field

MODEL_REPO = os.getenv("HF_MODEL_REPO", "Qwen/Qwen3-1.7B-GGUF")
MODEL_FILE = os.getenv("HF_MODEL_FILE", "Qwen3-1.7B-Q8_0.gguf")
MODEL_ALIAS = os.getenv("TRIZZY_MODEL_NAME", "trizzy-writer")
API_KEY = os.getenv("TRIZZY_SPACE_API_KEY", "").strip()
N_CTX = int(os.getenv("N_CTX", "4096"))
N_THREADS = int(os.getenv("N_THREADS", str(max(1, (os.cpu_count() or 2) - 1))))
N_BATCH = int(os.getenv("N_BATCH", "128"))

app = FastAPI(title="Trizzy Writer CPU API", version="0.1.0")
_model: Llama | None = None
_model_lock = threading.Lock()
_generation_lock = asyncio.Semaphore(1)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.78, ge=0, le=1.2)
    top_p: float = Field(default=0.92, gt=0, le=1)
    max_tokens: int = Field(default=1400, ge=1, le=2400)
    stream: bool = False


def require_api_key(authorization: str | None) -> None:
    if not API_KEY:
        return
    if authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token.")


def get_model() -> Llama:
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            _model = Llama.from_pretrained(
                repo_id=MODEL_REPO,
                filename=MODEL_FILE,
                n_ctx=N_CTX,
                n_threads=N_THREADS,
                n_batch=N_BATCH,
                verbose=False,
            )
    return _model


@app.get("/")
def root() -> dict[str, object]:
    return {
        "name": "Trizzy Writer CPU API",
        "model": MODEL_ALIAS,
        "model_repo": MODEL_REPO,
        "model_file": MODEL_FILE,
        "openai_compatible_endpoint": "/v1/chat/completions",
        "authenticated": bool(API_KEY),
    }


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": True,
        "model": MODEL_ALIAS,
        "loaded": _model is not None,
        "context": N_CTX,
        "threads": N_THREADS,
    }


@app.post("/v1/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    require_api_key(authorization)
    if request.stream:
        raise HTTPException(status_code=400, detail="Streaming is not enabled in the free CPU worker.")

    messages = [message.model_dump() for message in request.messages]

    async with _generation_lock:
        model = await asyncio.to_thread(get_model)
        result = await asyncio.to_thread(
            model.create_chat_completion,
            messages=messages,
            temperature=request.temperature,
            top_p=request.top_p,
            max_tokens=request.max_tokens,
            stream=False,
            chat_template_kwargs={"enable_thinking": False},
        )

    result["model"] = MODEL_ALIAS
    return result
