# Trizzy Writer

Trizzy Writer is Trey Trizzy's private AI songwriting workspace. The public repository contains application code only. Private lyrics, credentials, datasets, adapters, and model weights stay outside Git.

## Phase 1 features

- Full Song, Cadence Remix, Hook Lab, Bar Polish, and Locked Revision modes
- Locked lyric verification with one automatic repair pass
- Character-limit validation with one automatic repair pass
- Editable final output with copy and text export
- Approve and reject tracking
- JSONL export for future QLoRA fine-tuning
- Firebase anonymous authentication and Firestore sync when configured
- Local-only fallback when Firebase is not configured
- Local Ollama support and hosted OpenAI-compatible endpoint support
- Mobile-responsive interface

## Local setup

Requirements:

- Node.js 20.9 or newer
- Ollama

Install the application:

```bash
npm install
```

Download the default model:

```bash
ollama pull qwen3:1.7b
```

Create the local environment file:

```bash
copy .env.example .env.local
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Model providers

### Local Ollama

```text
TRIZZY_MODEL_PROVIDER=ollama
TRIZZY_MODEL_API_URL=http://127.0.0.1:11434/api/chat
TRIZZY_MODEL_NAME=qwen3:1.7b
```

### Hosted Hugging Face Space

The Space must expose an OpenAI-compatible `/v1/chat/completions` endpoint.

```text
TRIZZY_MODEL_PROVIDER=openai-compatible
TRIZZY_MODEL_API_URL=https://YOUR-SPACE.hf.space
TRIZZY_MODEL_API_TOKEN=
TRIZZY_MODEL_NAME=trizzy-writer
```

Tokens remain server-side and are never exposed through `NEXT_PUBLIC_` variables.

## Firebase

Create a Firebase project, enable Anonymous Authentication, and create a Firestore database. Add the Firebase web configuration values to `.env.local`.

Deploy the included security rules with the Firebase CLI:

```bash
firebase deploy --only firestore
```

Every user can only read and write records under their own `users/{uid}` path.

## Training data

After editing a model result, press **Approve** or **Reject**. Decisions are stored locally and optionally synced to Firestore. Press **Export dataset** to download approved examples as JSONL.

Do not approve drafts that still contain mistakes. Fine-tuning quality depends on the quality of the approved examples.

## Validation

```bash
npm run typecheck
npm run build
```

## Repository safety

Never commit:

- `.env.local`
- Firebase Admin service-account files
- Google OAuth credentials
- Unreleased lyrics
- JSONL datasets
- GGUF or SafeTensors model files
- LoRA adapters

## Video rendering notebook

The reusable Google Colab worker foundation is located at `notebooks/Trizzy_Writer_WAN21_Colab_Worker.ipynb`. Open it in Google Colab, select a GPU runtime, and run the setup cells to create the Google Drive render queue.

