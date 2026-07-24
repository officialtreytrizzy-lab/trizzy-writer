#!/usr/bin/env python3
"""Compare the Trey AI LoRA adapter against the base model on held-out behavior checks."""

from __future__ import annotations

import argparse
import gc
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

ROOT = Path(__file__).resolve().parents[1]
OPERATING_PROMPTS_PATH = ROOT / "src" / "lib" / "assistant" / "operating-prompts.json"
with OPERATING_PROMPTS_PATH.open("r", encoding="utf-8") as handle:
    OPERATING_PROMPTS = json.load(handle)
SHARED_SYSTEM_PROMPT = str(OPERATING_PROMPTS["shared"])
SPECIALTY_PROMPTS = {str(key): str(value) for key, value in OPERATING_PROMPTS["specialties"].items()}


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def contains(text: str, needle: str) -> bool:
    return needle.casefold() in text.casefold()


def run_checks(response: str, raw_response: str, checks: dict[str, Any]) -> dict[str, Any]:
    outcomes: list[dict[str, Any]] = []

    def add(name: str, passed: bool, detail: str) -> None:
        outcomes.append({"name": name, "passed": passed, "detail": detail})

    all_required = checks.get("mustIncludeAll", [])
    if all_required:
        missing = [item for item in all_required if not contains(response, item)]
        add("mustIncludeAll", not missing, "missing=" + ", ".join(missing) if missing else "all present")

    any_required = checks.get("mustIncludeAny", [])
    if any_required:
        matched = [item for item in any_required if contains(response, item)]
        add("mustIncludeAny", bool(matched), "matched=" + ", ".join(matched) if matched else "none matched")

    any_secondary = checks.get("mustIncludeAnySecondary", [])
    if any_secondary:
        matched = [item for item in any_secondary if contains(response, item)]
        add("mustIncludeAnySecondary", bool(matched), "matched=" + ", ".join(matched) if matched else "none matched")

    forbidden = checks.get("mustNotInclude", [])
    if forbidden:
        present = [item for item in forbidden if contains(response, item)]
        add("mustNotInclude", not present, "present=" + ", ".join(present) if present else "none present")

    max_characters = checks.get("maxCharacters")
    if max_characters is not None:
        add("maxCharacters", len(response) <= int(max_characters), f"length={len(response)} limit={max_characters}")

    minimum_characters = checks.get("minimumCharacters")
    if minimum_characters is not None:
        add("minimumCharacters", len(response) >= int(minimum_characters), f"length={len(response)} minimum={minimum_characters}")

    visible_thinking = "<think>" in raw_response.casefold() or "</think>" in raw_response.casefold()
    add("noVisibleThinking", not visible_thinking, "thinking tags present" if visible_thinking else "no thinking tags")

    return {
        "passed": all(item["passed"] for item in outcomes),
        "checks": outcomes,
    }


def strip_thinking(text: str) -> str:
    cleaned = text.strip()
    if "</think>" in cleaned:
        cleaned = cleaned.split("</think>", 1)[1].strip()
    return cleaned


def render_prompt(
    tokenizer: AutoTokenizer,
    system_prompt: str,
    user_prompt: str,
    specialty: str | None = None,
) -> str:
    specialty_prompt = SPECIALTY_PROMPTS.get(specialty or "", "")
    routed_system_prompt = system_prompt
    if specialty_prompt:
        routed_system_prompt += f"\n\nACTIVE SPECIALTY: {specialty}\n{specialty_prompt}"
    messages = [
        {"role": "system", "content": routed_system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        return tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )
    except TypeError:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)


def load_model(base_model: str, adapter_dir: Path | None):
    use_bf16 = bool(torch.cuda.is_bf16_supported())
    dtype = torch.bfloat16 if use_bf16 else torch.float16
    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=dtype,
    )
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=quantization,
        device_map={"": 0},
        torch_dtype=dtype,
        low_cpu_mem_usage=True,
    )
    if adapter_dir is not None:
        model = PeftModel.from_pretrained(model, str(adapter_dir))
    model.eval()
    return model


def generate_suite(
    label: str,
    base_model: str,
    adapter_dir: Path | None,
    tokenizer: AutoTokenizer,
    suite: dict[str, Any],
    max_new_tokens: int,
) -> dict[str, Any]:
    model = load_model(base_model, adapter_dir)
    results: list[dict[str, Any]] = []

    for case in suite["cases"]:
        prompt_text = render_prompt(tokenizer, suite["systemPrompt"], case["prompt"], case.get("specialty"))
        inputs = tokenizer(prompt_text, return_tensors="pt").to("cuda")
        with torch.inference_mode():
            output = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                repetition_penalty=1.05,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )
        generated_tokens = output[0, inputs["input_ids"].shape[1] :]
        raw_response = tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()
        response = strip_thinking(raw_response)
        evaluation = run_checks(response, raw_response, case["checks"])
        results.append(
            {
                "id": case["id"],
                "specialty": case.get("specialty"),
                "prompt": case["prompt"],
                "response": response,
                "rawResponse": raw_response,
                **evaluation,
            }
        )

    passed = sum(1 for item in results if item["passed"])
    report = {
        "label": label,
        "passedCases": passed,
        "totalCases": len(results),
        "passRate": passed / max(1, len(results)),
        "cases": results,
    }

    del model
    gc.collect()
    torch.cuda.empty_cache()
    return report


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Trey AI Adapter Evaluation",
        "",
        f"Generated: {report['generatedAt']}",
        f"Quality gate: {report['qualityGate']:.0%}",
        f"Base pass rate: {report['base']['passRate']:.0%}",
        f"Adapter pass rate: {report['adapter']['passRate']:.0%}",
        f"Gate passed: {'YES' if report['gatePassed'] else 'NO'}",
        "",
    ]
    for section_name in ["base", "adapter"]:
        section = report[section_name]
        lines.extend([f"## {section_name.title()}", ""])
        for case in section["cases"]:
            lines.append(f"### {case['id']} — {'PASS' if case['passed'] else 'FAIL'}")
            lines.append("")
            lines.append(case["response"] or "(empty response)")
            lines.append("")
            for check in case["checks"]:
                lines.append(f"- {'PASS' if check['passed'] else 'FAIL'} {check['name']}: {check['detail']}")
            lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="training/config.json")
    parser.add_argument("--adapter-dir", help="Override the adapter directory from the config.")
    parser.add_argument("--report-name", default="adapter_eval", help="Report filename stem inside training/reports.")
    parser.add_argument("--skip-base", action="store_true", help="Evaluate only the adapter.")
    parser.add_argument("--allow-fail", action="store_true", help="Write reports without a failing exit code.")
    args = parser.parse_args()

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU is required for adapter evaluation.")

    config = load_json(resolve_path(args.config))
    suite = load_json(resolve_path(config["eval_cases_file"]))
    if suite.get("systemPrompt") != SHARED_SYSTEM_PROMPT:
        raise RuntimeError(
            "Evaluation system prompt drift detected. Update training/eval_cases.json from "
            f"{OPERATING_PROMPTS_PATH.relative_to(ROOT)} before evaluating."
        )
    adapter_dir = resolve_path(args.adapter_dir or config["output_dir"])
    if not adapter_dir.exists():
        raise FileNotFoundError(f"Adapter directory does not exist: {adapter_dir}")

    tokenizer = AutoTokenizer.from_pretrained(str(adapter_dir), use_fast=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "left"

    if args.skip_base:
        base_report = {"label": "base-skipped", "passedCases": 0, "totalCases": 0, "passRate": 0.0, "cases": []}
    else:
        base_report = generate_suite(
            "base",
            config["base_model"],
            None,
            tokenizer,
            suite,
            int(config["max_new_tokens"]),
        )

    adapter_report = generate_suite(
        "adapter",
        config["base_model"],
        adapter_dir,
        tokenizer,
        suite,
        int(config["max_new_tokens"]),
    )

    quality_gate = float(config["quality_gate"])
    base_comparison_passed = args.skip_base or adapter_report["passRate"] >= base_report["passRate"]
    gate_passed = adapter_report["passRate"] >= quality_gate and base_comparison_passed
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "qualityGate": quality_gate,
        "baseComparisonPassed": base_comparison_passed,
        "gatePassed": gate_passed,
        "base": base_report,
        "adapter": adapter_report,
    }

    report_dir = ROOT / "training" / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_stem = args.report_name.strip() or "adapter_eval"
    json_report = report_dir / f"{report_stem}.json"
    markdown_report_path = report_dir / f"{report_stem}.md"
    json_report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    markdown_report_path.write_text(markdown_report(report) + "\n", encoding="utf-8")
    print(json.dumps({
        "gatePassed": gate_passed,
        "basePassRate": base_report["passRate"],
        "adapterPassRate": adapter_report["passRate"],
        "report": str(json_report),
    }, indent=2))

    if not gate_passed and not args.allow_fail:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
