#!/usr/bin/env python3
"""Merge the approved Trey AI LoRA adapter into the original Qwen3 base model."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="training/config.json")
    parser.add_argument("--force", action="store_true")
    parser.add_argument(
        "--evaluation-report",
        help="Override the quality-gate report path configured for this adapter.",
    )
    args = parser.parse_args()

    config = load_json(resolve_path(args.config))
    adapter_dir = resolve_path(config["output_dir"])
    merged_dir = resolve_path(config["merged_dir"])
    configured_report = args.evaluation_report or config.get(
        "evaluation_report", "training/reports/adapter_eval.json"
    )
    evaluation_path = resolve_path(str(configured_report))

    if not adapter_dir.exists():
        raise FileNotFoundError(f"Adapter directory does not exist: {adapter_dir}")
    evaluation: dict[str, Any] | None = None
    if not evaluation_path.exists() and not args.force:
        raise RuntimeError(
            f"Adapter evaluation report is missing at {evaluation_path}. "
            "Run the configured evaluation command first."
        )
    if evaluation_path.exists():
        evaluation = load_json(evaluation_path)
        if not evaluation.get("gatePassed") and not args.force:
            raise RuntimeError(
                "The configured adapter evaluation did not pass the quality gate. "
                "Refusing to merge without --force."
            )

    merged_dir.mkdir(parents=True, exist_ok=True)
    dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float16
    device_map: str | dict[str, int] = "auto" if torch.cuda.is_available() else {"": "cpu"}

    base = AutoModelForCausalLM.from_pretrained(
        config["base_model"],
        torch_dtype=dtype,
        device_map=device_map,
        low_cpu_mem_usage=True,
    )
    model = PeftModel.from_pretrained(base, str(adapter_dir))
    merged = model.merge_and_unload(safe_merge=True)
    merged.config.use_cache = True
    merged.save_pretrained(
        str(merged_dir),
        safe_serialization=True,
        max_shard_size="4GB",
    )

    tokenizer = AutoTokenizer.from_pretrained(str(adapter_dir), use_fast=True)
    tokenizer.save_pretrained(str(merged_dir))

    manifest = {
        "mergedAt": datetime.now(timezone.utc).isoformat(),
        "baseModel": config["base_model"],
        "adapterDirectory": str(adapter_dir.relative_to(ROOT)),
        "mergedDirectory": str(merged_dir.relative_to(ROOT)),
        "evaluationReport": str(evaluation_path.relative_to(ROOT)),
        "evaluationGatePassed": bool(evaluation and evaluation.get("gatePassed")),
        "adapterPassRate": (
            evaluation.get("adapter", {}).get("passRate") if evaluation else None
        ),
        "qualityGateForced": bool(args.force),
    }
    (merged_dir / "merge_manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
