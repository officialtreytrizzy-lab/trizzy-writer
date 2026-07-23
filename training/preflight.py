#!/usr/bin/env python3
"""Validate Trey AI training data, environment, and estimated run shape."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import platform
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def count_jsonl(path: Path) -> int:
    with path.open("r", encoding="utf-8") as handle:
        return sum(1 for line in handle if line.strip())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="training/config.json")
    parser.add_argument("--require-gpu", action="store_true")
    args = parser.parse_args()

    config = load_json(resolve_path(args.config))
    train_path = resolve_path(config["train_file"])
    eval_path = resolve_path(config["eval_file"])
    eval_cases_path = resolve_path(config["eval_cases_file"])

    problems: list[str] = []
    for path in [train_path, eval_path, eval_cases_path]:
        if not path.exists():
            problems.append(f"Missing required file: {path}")

    train_rows = count_jsonl(train_path) if train_path.exists() else 0
    eval_rows = count_jsonl(eval_path) if eval_path.exists() else 0
    minimum_train_rows = int(config.get("minimum_train_rows", 75))
    minimum_eval_rows = int(config.get("minimum_eval_rows", 10))
    if train_rows < minimum_train_rows:
        problems.append(f"Training split is too small: {train_rows} < {minimum_train_rows}")
    if eval_rows < minimum_eval_rows:
        problems.append(f"Evaluation split is too small: {eval_rows} < {minimum_eval_rows}")

    packages = ["torch", "transformers", "accelerate", "bitsandbytes", "datasets", "peft", "trl"]
    package_status = {name: bool(importlib.util.find_spec(name)) for name in packages}

    cuda_available = False
    gpu_name = None
    total_vram_bytes = 0
    torch_version = None
    if package_status["torch"]:
        import torch

        torch_version = torch.__version__
        cuda_available = bool(torch.cuda.is_available())
        if cuda_available:
            gpu_name = torch.cuda.get_device_name(0)
            total_vram_bytes = torch.cuda.get_device_properties(0).total_memory

    if args.require_gpu and not cuda_available:
        problems.append("CUDA GPU is required but is not available.")
    if cuda_available and total_vram_bytes < 10 * 1024**3:
        problems.append(f"GPU VRAM is below the 10 GiB training floor: {total_vram_bytes / 1024**3:.1f} GiB")

    missing_training_packages = [name for name, present in package_status.items() if not present]
    if args.require_gpu and missing_training_packages:
        problems.append("Missing training packages: " + ", ".join(missing_training_packages))

    micro_batch = int(config["per_device_train_batch_size"])
    grad_accum = int(config["gradient_accumulation_steps"])
    epochs = float(config["num_train_epochs"])
    optimizer_steps = math.ceil(train_rows / max(1, micro_batch * grad_accum) * epochs)

    report = {
        "ok": not problems,
        "root": str(ROOT),
        "python": sys.version,
        "platform": platform.platform(),
        "cpuCount": os.cpu_count(),
        "torchVersion": torch_version,
        "cudaAvailable": cuda_available,
        "gpuName": gpu_name,
        "totalVramGiB": round(total_vram_bytes / 1024**3, 2) if total_vram_bytes else 0,
        "packages": package_status,
        "trainRows": train_rows,
        "evalRows": eval_rows,
        "effectiveBatchSize": micro_batch * grad_accum,
        "estimatedOptimizerSteps": optimizer_steps,
        "baseModel": config["base_model"],
        "problems": problems,
    }
    print(json.dumps(report, indent=2))
    if problems:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
