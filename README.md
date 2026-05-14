# Rethlasoft Extract

Speaker-diarized transcripts from audio. See [`docs/PRD.md`](docs/PRD.md). **Hosted production** targets the shared self-hosting platform described in **§5.15** (Coolify, Traefik/Caddy, Postgres, Redis, MinIO, Stripe, shared auth—see linked platform PRD there).

## Privacy & Security

**Rethlasoft Extract** is a **local-first utility**. All audio-to-text processing occurs on your local machine. No data is transmitted to or stored on external servers, making it suitable for sensitive legal and medical transcriptions. Your audio files and transcripts remain entirely under your control, ensuring compliance with privacy regulations and professional confidentiality requirements.

## Stack

| Layer    | Choice | Notes |
|----------|--------|--------|
| Backend  | **FastAPI** | Async-friendly, OpenAPI docs, fits Python ML workers (WhisperX) later. |
| Frontend | **React + Vite + TypeScript** | Strong ecosystem for **i18n** (EN/ES), auth, and admin UI; fast dev UX. |

Alternatives considered: **Next.js** if you need SSR for marketing pages; **Svelte/Vue** are fine but React has the widest library coverage for billing and admin patterns.

## Phase 1 — CLI (local transcription)

The default path is tuned for **Spanish** audio with possible **Catalan** (mixed speech): multilingual Whisper **`large-v3`**, ASR language **`es`** by default, and **Spanish** transcript headers. Use `--language auto` to detect language from the first ~30 seconds, or `--language ca` if you want to lock Catalan for the ASR pass.

**Prerequisites:** **ffmpeg** on your `PATH`; a Hugging Face **read token** with access to the diarization models you use (`HF_TOKEN` or `HUGGINGFACE_TOKEN`). Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` if you want to load the token from a file.

Put test audio under the repo’s ignored **`data/`** directory (tracked as an empty tree via `data/.gitkeep`).

```bash
cd backend
uv sync
export HF_TOKEN=...   # or: cp .env.example .env  # then edit
uv run transcript path/to/audio.m4a ../data/out
```

Options include `-l es` (default ASR language), `--locale es|en` (header labels), `-m large-v3`, and `--compute-type int8` on CPU if memory is tight.

Progress and timing go to **stderr** (INFO by default: load steps, ~10% progress for transcribe / align / diarize). Use **`--verbose` / `-v`** for DEBUG (finer progress), or **`--quiet` / `-q`** for warnings only.

After **alignment** completes, the CLI writes **`{stem}_after_align.json`** next to the transcript (in the output directory). If **diarization** fails later (e.g. Hugging Face access), re-run with **`--resume path/to/that.json`** and the **same** input audio to continue from diarization only—no second transcribe/align pass. Runs that failed *before* this checkpoint existed must complete transcribe+align once to produce the JSON.

**Batching / timing table:** Run **one file per command** (same as now). Each successful run **appends one row** to **`extraction_timings.csv`** in the output directory (UTC timestamp, audio length, device, model, seconds per phase, transcript path). Use **`--timings-log /path/to/custom.csv`** to keep a single shared file (e.g. under `docs/`), or **`--no-timings-log`** to disable. Open the CSV in Numbers/Excel/Sheets.

## Quick start

**Terminal 1 — API** (from repo root):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- http://127.0.0.1:8000/docs — OpenAPI  
- http://127.0.0.1:8000/api/health — health JSON  

**Terminal 2 — UI:**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server **proxies** `/api` to the backend on port 8000.

## Layout

```
backend/    # Python package `app`, FastAPI + Phase 1 `transcript` CLI
frontend/   # Vite React SPA
data/       # Local audio/output (gitignored except .gitkeep)
docs/       # PRD
```
