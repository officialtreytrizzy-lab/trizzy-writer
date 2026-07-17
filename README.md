# Trizzy Writer

Trizzy Writer is Trey Trizzy's private AI songwriting workspace.

## Phase 1 stack

- Next.js + TypeScript
- Firebase Authentication and Firestore
- Google Drive for private datasets, adapters, exports, and backups
- Google Colab for fine-tuning and model conversion
- Hugging Face CPU Space for the free public inference endpoint

## Phase 1 goals

- Full Song, Cadence Remix, Hook Lab, Bar Polish, and Locked Revision modes
- Locked lyric protection
- Character-limit validation
- Approved and rejected example tracking
- Exportable JSONL training data
- Mobile-first interface

## Security

This repository contains application code only. Do not commit Firebase Admin credentials, OAuth secrets, unreleased lyrics, training datasets, model weights, LoRA adapters, GGUF files, or local environment files.

## Status

Initial public-safe scaffold started. Firebase and inference integration are the next implementation steps.
