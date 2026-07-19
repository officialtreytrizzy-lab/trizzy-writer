# Trizzy Writer

Trizzy Writer is Trey Trizzy's private AI songwriting workspace. This public repository contains application code only. Private lyrics, credentials, datasets, adapters, and model weights stay outside Git.

## Current Phase 1 features

- Full Song, Cadence Remix, Hook Lab, Bar Polish, and Locked Revision modes
- Clean, Explicit, and Raw Adult content controls
- Locked lyric verification with one automatic repair pass
- Character-limit validation with a CPU-aware token budget
- Qwen non-thinking mode with defensive reasoning removal
- Editable final output with copy and text export
- Approve and reject tracking with detailed ratings and notes
- Automatic lyric analysis stored with each decision
- JSONL export for future QLoRA fine-tuning
- Firebase Google, email/password, and anonymous authentication
- Per-user Firestore decision storage when Firebase is configured
- Local-only history and decision fallback when Firebase is not configured
- Local Ollama and OpenAI-compatible model-server support
- Mobile-responsive interface
- GitHub Actions type-check and production-build validation

## Lightning AI free CPU deployment

Lightning runs Qwen3 1.7B Q4 through `llama-cpp-python`. Ollama is used only to download the public GGUF model because its bundled inference runner is not stable on every Lightning virtual CPU.

### First-time setup

Open a free CPU Studio, clone this repository, and run:

```bash
cd trizzy-writer
npm run lightning:setup
npm run lightning:start
```

The setup process:

1. Installs Node dependencies.
2. Installs the prebuilt CPU `llama-cpp-python` server.
3. Downloads Qwen3 1.7B Q4.
4. Copies the GGUF into persistent Studio storage.
5. Builds the production Next.js app.

The start command launches:

- CPU model server on private port `8000`
- Trizzy Writer on public port `3000`
- Qwen non-thinking mode through `enable_thinking=false`

Add port `3000` to Lightning's Port Viewer and name it **Trizzy Writer**.

### After a free-tier restart

Files and model weights remain in the Studio workspace. Restart both services with:

```bash
npm run lightning:start
```

Check status:

```bash
npm run lightning:status
```

Run a real lyric-generation smoke test:

```bash
npm run lightning:smoke
```

Stop both services:

```bash
npm run lightning:stop
```

## Local development with Ollama

Requirements:

- Node.js 20.9 or newer
- Ollama, when using a local model

```bash
npm install
ollama pull qwen3:1.7b
cp .env.example .env.local
npm run dev
```

On Windows Command Prompt, use:

```bat
copy .env.example .env.local
```

Open `http://localhost:3000`.

For a production-style local run:

```bash
npm run build
npm run start
```

## Model providers

### Local Ollama

```text
TRIZZY_MODEL_PROVIDER=ollama
TRIZZY_MODEL_API_URL=http://127.0.0.1:11434/api/chat
TRIZZY_MODEL_NAME=qwen3:1.7b
```

### OpenAI-compatible server

The server must expose `/v1/models` and `/v1/chat/completions`.

```text
TRIZZY_MODEL_PROVIDER=openai-compatible
TRIZZY_MODEL_API_URL=http://127.0.0.1:8000
TRIZZY_MODEL_API_TOKEN=
TRIZZY_MODEL_NAME=trizzy-writer
```

A hosted Hugging Face Space or another compatible endpoint can replace the local URL. Model tokens remain server-side and must never use a `NEXT_PUBLIC_` environment variable.

## Firebase setup

1. Create a Firebase project.
2. Add a Web App inside the project.
3. Enable the desired Authentication providers:
   - Google
   - Email/Password
   - Anonymous
4. Create a Cloud Firestore database.
5. Copy the Firebase Web App configuration into `.env.local`.
6. Install the Firebase CLI and deploy the included Firestore configuration.

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore
```

The included Firestore rules restrict every user's documents to that authenticated user's `users/{uid}` path.

Firebase browser configuration values identify the Firebase project but are not administrator secrets. Service-account files and private keys must still remain outside Git.

## Authentication behavior

- With no Firebase configuration, Trizzy Writer remains in local mode.
- A guest session uses Firebase Anonymous Authentication.
- Connecting Google or creating an email account upgrades an anonymous session when possible.
- Approved and rejected examples sync beneath the authenticated user's Firestore path.

## Training data

After editing a model result, press **Approve** or **Reject**. Decisions are stored locally and optionally synced to Firestore. Press **Export dataset** to download approved examples as JSONL.

Only approve writing that is genuinely correct. Rejected drafts and unfinished revisions should not enter the fine-tuning dataset.

Recommended private storage:

```text
Google Drive/
└── Trizzy Writer/
    ├── training-data/
    ├── adapters/
    ├── models/
    ├── exports/
    └── backups/
```

## Validation

```bash
npm run typecheck
npm run build
```

GitHub Actions runs both checks on pushes and pull requests targeting `main`.

## Repository safety

Never commit:

- `.env.local`
- Firebase Admin service-account files
- Google OAuth credentials
- Unreleased lyrics
- JSONL datasets
- GGUF or SafeTensors model files
- LoRA adapters
- Private exports or backups

## Google Colab and video rendering

Google Colab is intended for dataset preparation, fine-tuning, evaluation, adapter merging, GGUF conversion, and temporary GPU media work. It is not used as the permanent public API because free Colab runtimes disconnect.

The reusable WAN worker is located at `notebooks/Trizzy_Writer_WAN21_Colab_Worker.ipynb`. It is separate from the core songwriting inference service.
