#!/usr/bin/env python3
"""QLoRA supervised fine-tuning for Trey AI behavior.

This script intentionally trains stable behavior and workflow rules only.
Changing facts, repositories, catalog status, and analytics remain in retrieval.
"""

from __future__ import annotations

import argparse
import inspect
import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
from datasets import load_dataset
from peft import LoraConfig, PeftModel, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, set_seed
from trl import SFTConfig, SFTTrainer

ROOT = Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True
        ).strip()
    except Exception:
        return "unknown"


def package_version(name: str) -> str:
    try:
        from importlib.metadata import version

        return version(name)
    except Exception:
        return "unknown"


def supported_kwargs(cls: type[Any], candidates: dict[str, Any]) -> dict[str, Any]:
    signature = inspect.signature(cls.__init__)
    parameters = signature.parameters
    if any(param.kind is inspect.Parameter.VAR_KEYWORD for param in parameters.values()):
        return candidates
    return {key: value for key, value in candidates.items() if key in parameters}


def make_sft_config(config: dict[str, Any], output_dir: Path, use_bf16: bool) -> SFTConfig:
    candidates: dict[str, Any] = {
        "output_dir": str(output_dir),
        "num_train_epochs": float(config["num_train_epochs"]),
        "learning_rate": float(config["learning_rate"]),
        "per_device_train_batch_size": int(config["per_device_train_batch_size"]),
        "per_device_eval_batch_size": int(config["per_device_eval_batch_size"]),
        "gradient_accumulation_steps": int(config["gradient_accumulation_steps"]),
        "warmup_ratio": float(config["warmup_ratio"]),
        "weight_decay": float(config["weight_decay"]),
        "logging_steps": int(config["logging_steps"]),
        "eval_steps": int(config["eval_steps"]),
        "save_steps": int(config["save_steps"]),
        "save_total_limit": int(config["save_total_limit"]),
        "eval_strategy": "steps",
        "evaluation_strategy": "steps",
        "save_strategy": "steps",
        "logging_strategy": "steps",
        "load_best_model_at_end": True,
        "metric_for_best_model": "eval_loss",
        "greater_is_better": False,
        "lr_scheduler_type": "cosine",
        "optim": "paged_adamw_8bit",
        "max_grad_norm": 0.3,
        "gradient_checkpointing": True,
        "gradient_checkpointing_kwargs": {"use_reentrant": False},
        "bf16": use_bf16,
        "fp16": not use_bf16,
        "tf32": torch.cuda.is_available() and torch.cuda.get_device_capability(0)[0] >= 8,
        "report_to": "none",
        "seed": int(config["seed"]),
        "data_seed": int(config["seed"]),
        "save_safetensors": True,
        "remove_unused_columns": True,
        "dataset_num_proc": max(1, min(4, os.cpu_count() or 1)),
        "max_length": int(config["max_length"]),
        "max_seq_length": int(config["max_length"]),
        "packing": False,
        "completion_only_loss": True,
        "assistant_only_loss": False,
    }
    filtered = supported_kwargs(SFTConfig, candidates)
    if "max_length" not in filtered and "max_seq_length" not in filtered:
        raise RuntimeError("Installed TRL does not expose a supported maximum-length option.")
    return SFTConfig(**filtered)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="training/config.json")
    parser.add_argument("--resume-from-checkpoint", default=None)
    parser.add_argument("--max-steps", type=int, default=None, help="Optional smoke-run limit.")
    args = parser.parse_args()

    config_path = resolve_path(args.config)
    config = load_json(config_path)
    train_path = resolve_path(config["train_file"])
    eval_path = resolve_path(config["eval_file"])
    output_dir = resolve_path(config["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA GPU is required for QLoRA training. Prepare data on CPU, then switch the Lightning Studio to a GPU."
        )
    if not train_path.exists() or not eval_path.exists():
        raise FileNotFoundError("Training data is missing. Run `npm run train:data` first.")

    set_seed(int(config["seed"]))
    use_bf16 = bool(torch.cuda.is_bf16_supported())
    compute_dtype = torch.bfloat16 if use_bf16 else torch.float16
    device_name = torch.cuda.get_device_name(0)
    total_vram = torch.cuda.get_device_properties(0).total_memory

    run_manifest = {
        "startedAt": utc_now(),
        "gitCommit": git_commit(),
        "baseModel": config["base_model"],
        "trainFile": str(train_path.relative_to(ROOT)),
        "evalFile": str(eval_path.relative_to(ROOT)),
        "outputDir": str(output_dir.relative_to(ROOT)),
        "device": device_name,
        "totalVramBytes": total_vram,
        "computeDtype": str(compute_dtype),
        "python": sys.version,
        "platform": platform.platform(),
        "packages": {
            name: package_version(name)
            for name in ["torch", "transformers", "trl", "peft", "datasets", "bitsandbytes"]
        },
        "config": config,
    }
    (output_dir / "run_manifest.json").write_text(
        json.dumps(run_manifest, indent=2) + "\n", encoding="utf-8"
    )

    tokenizer = AutoTokenizer.from_pretrained(config["base_model"], use_fast=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    model = AutoModelForCausalLM.from_pretrained(
        config["base_model"],
        quantization_config=quantization,
        device_map={"": 0},
        torch_dtype=compute_dtype,
        low_cpu_mem_usage=True,
    )
    model.config.use_cache = False
    prepare_kwargs: dict[str, Any] = {"use_gradient_checkpointing": True}
    if "gradient_checkpointing_kwargs" in inspect.signature(prepare_model_for_kbit_training).parameters:
        prepare_kwargs["gradient_checkpointing_kwargs"] = {"use_reentrant": False}
    model = prepare_model_for_kbit_training(model, **prepare_kwargs)
    adapter_path_value = config.get("adapter_path")
    adapter_path = resolve_path(adapter_path_value) if adapter_path_value else None
    if adapter_path is not None:
        if not adapter_path.exists():
            raise FileNotFoundError(f"Continuation adapter does not exist: {adapter_path}")
        model = PeftModel.from_pretrained(model, str(adapter_path), is_trainable=True)

    train_dataset = load_dataset("json", data_files=str(train_path), split="train")
    eval_dataset = load_dataset("json", data_files=str(eval_path), split="train")

    lora_config = None
    if adapter_path is None:
        lora_config = LoraConfig(
            r=int(config["lora_r"]),
            lora_alpha=int(config["lora_alpha"]),
            lora_dropout=float(config["lora_dropout"]),
            target_modules=config["target_modules"],
            bias="none",
            task_type="CAUSAL_LM",
        )

    sft_config = make_sft_config(config, output_dir, use_bf16)
    if args.max_steps is not None:
        sft_config.max_steps = args.max_steps
        sft_config.num_train_epochs = 1
        sft_config.eval_steps = max(1, min(sft_config.eval_steps, args.max_steps))
        sft_config.save_steps = max(1, min(sft_config.save_steps, args.max_steps))

    trainer_candidates: dict[str, Any] = {
        "model": model,
        "args": sft_config,
        "train_dataset": train_dataset,
        "eval_dataset": eval_dataset,
        "processing_class": tokenizer,
        "tokenizer": tokenizer,
    }
    if lora_config is not None:
        trainer_candidates["peft_config"] = lora_config
    trainer = SFTTrainer(**supported_kwargs(SFTTrainer, trainer_candidates))

    train_result = trainer.train(resume_from_checkpoint=args.resume_from_checkpoint)
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    eval_metrics = trainer.evaluate()
    summary = {
        "completedAt": utc_now(),
        "trainMetrics": train_result.metrics,
        "evalMetrics": eval_metrics,
        "trainRows": len(train_dataset),
        "evalRows": len(eval_dataset),
        "adapterDirectory": str(output_dir),
    }
    (output_dir / "training_summary.json").write_text(
        json.dumps(summary, indent=2, default=str) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
