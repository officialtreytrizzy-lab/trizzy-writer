from __future__ import annotations

import os

from huggingface_hub import HfApi


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def main() -> None:
    token = required_env("HF_TOKEN")
    repo_id = required_env("HF_SPACE_REPO")
    private = os.getenv("HF_SPACE_PRIVATE", "false").strip().lower() == "true"

    api = HfApi(token=token)
    api.create_repo(
        repo_id=repo_id,
        repo_type="space",
        space_sdk="docker",
        private=private,
        exist_ok=True,
    )
    api.upload_folder(
        repo_id=repo_id,
        repo_type="space",
        folder_path="space",
        commit_message="Deploy Trizzy Writer CPU API",
        ignore_patterns=["__pycache__/**", "*.pyc", ".env*", "*.gguf", "*.safetensors"],
    )
    print(f"Deployed Hugging Face Space: {repo_id}")


if __name__ == "__main__":
    main()
