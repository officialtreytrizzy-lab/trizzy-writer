# Trey AI Fine-Tuning

This package trains a private LoRA adapter for stable Trey AI behavior. It does **not** train the model to memorize changing repositories, release dates, analytics, passwords, or catalog status. Those belong in the private knowledge vault and retrieval layer.

## Training target

- Base model: `Qwen/Qwen3-1.7B`
- Method: supervised fine-tuning with 4-bit NF4 QLoRA
- Adapter target: all linear transformer layers
- Primary goal: response discipline, creative rules, A&R judgment, coding verification, memory boundaries, and private operating-system behavior
- Production inference target after evaluation: merged model exported to GGUF Q4_K_M

The existing `models/qwen3-1.7b-q4.gguf` file is an inference artifact and is not used directly as the training source. Fine-tuning starts from the original Hugging Face base weights, produces a LoRA adapter, evaluates it, then optionally merges and exports a new GGUF.

## Data policy

Training examples must be:

- explicitly approved behavior or final responses;
- stable enough to belong in model behavior;
- free of secrets and temporary credentials;
- separated from volatile facts that should remain retrievable;
- deduplicated and assigned to a held-out evaluation split.

Do not train on raw chat history, rejected drafts, unverified claims, or entire repository dumps.

## CPU preparation

```bash
npm install
npm run train:data
npm run train:validate
python3 training/preflight.py
python3 -m pip install -r training/requirements.txt
```

Use the CPU Studio for data generation, dependency preparation, and code validation. Do not spend GPU time debugging basic setup.

## GPU training

A 16 GB T4-class GPU or better is the practical starting target for this 1.7B QLoRA configuration.

```bash
npm run train:preflight -- --require-gpu
npm run train:qlora
```

For a short pipeline smoke test before the full run:

```bash
python3 training/train_qlora.py --max-steps 2
```

The full run writes checkpoints and the final adapter under:

```text
training/output/trizzy-writer-qwen3-1.7b-lora/
```

## Behavioral evaluation

```bash
npm run train:evaluate
```

The evaluator compares the base model and the adapter on held-out rules such as:

- protecting approved lyrics;
- keeping Suno prompts compliant;
- giving honest A&R decisions;
- verifying release and deployment status;
- preserving dirty repository work;
- refusing fabricated tool results;
- enforcing TREMIX vocal and stem policies;
- keeping changing facts in retrieval rather than weights.

The adapter must score at least 80% and must not score below the base model. Training loss alone is not a deployment signal.

Reports are written to:

```text
training/reports/adapter_eval.json
training/reports/adapter_eval.md
```

## Merge and GGUF export

The merge command refuses to continue unless the quality gate passes:

```bash
npm run train:merge
```

To export GGUF, point `LLAMA_CPP_DIR` to a built current llama.cpp checkout:

```bash
export LLAMA_CPP_DIR=/path/to/llama.cpp
npm run train:export-gguf
```

The export is written to `training/exports/` and does not replace the live production model automatically. Run a final inference smoke test before activation.

## Resume a run

```bash
python3 training/train_qlora.py \
  --resume-from-checkpoint training/output/trizzy-writer-qwen3-1.7b-lora/checkpoint-XX
```

## Security and cost controls

- Never commit Hugging Face tokens, Lightning credentials, or private keys.
- Prepare on CPU and switch to GPU only for training and evaluation.
- Stop or downgrade the GPU after the run.
- Do not activate a new production GGUF without an explicit quality check and rollback path.
