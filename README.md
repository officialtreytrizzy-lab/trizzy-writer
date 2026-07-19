# Trizzy Writer

Trizzy Writer is Trey Trizzy's private AI songwriting workspace. This public repository contains application code only. Private lyrics, credentials, datasets, adapters, and model weights stay outside Git.

## Current Phase 1 features

- Full Song, Cadence Remix, Hook Lab, Bar Polish, and Locked Revision modes
- Clean, Explicit, and Raw Adult content controls
- Locked lyric verification with one automatic repair pass
- Character-limit validation with one automatic repair pass
- Editable final output with copy and text export
- Approve and reject tracking with detailed ratings and notes
- Automatic lyric analysis stored with each decision
- JSONL export for future QLoRA fine-tuning
- Firebase Google, email/password, and anonymous authentication
- Per-user Firestore decision storage when Firebase is configured
- Local-only history and decision fallback when Firebase is not configured
- Local Ollama and hosted OpenAI-compatible model support
- Mobile-responsive interface
- GitHub Actions type-check and production-build validation

## Local setup

Requirements:

- Node.js 20.9 or newer
- Ollama, when using a local model

Install the application:

```bash
npm install
```

Download the default local model:

```bash
ollama pull qwen3:1.7b
```

Create the local environment file:

```bash
cp .env.example .env.local
```

On Windows Command Prompt, use:

```bat
copy .env.example .env.local
```

Start the development server:

```bash
npm run dev:hot
```

Open `http://localhost:876`.

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

### Hosted Hugging Face Space or another compatible server

The server must expose an OpenAI-compatible `/v1/chat/completions` endpoint.

```text
TRIZZY_MODEL_PROVIDER=openai-compatible
TRIZZY_MODEL_API_URL=https://YOUR-ENDPOINT.example
TRIZZY_MODEL_API_TOKEN=
TRIZZY_MODEL_NAME=trizzy-writer
```

Model tokens remain server-side and must never use a `NEXT_PUBLIC_` environment variable.

## Firebase setup

1. Create a Firebase project.
2. Add a Web App inside the project.
3. Enable these Authentication providers:
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

## Google Colab

Google Colab is intended for dataset preparation, fine-tuning, evaluation, adapter merging, and GGUF conversion. It is not used as the permanent public API because free Colab runtimes disconnect and should not be treated as always-on hosting.

The repository may include experimental notebooks for other Trey Trizzy media workflows. Those notebooks are separate from the core songwriting application and do not change the Trizzy Writer model architecture.
