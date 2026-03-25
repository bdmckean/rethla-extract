# Transcript App

Speaker-diarized transcripts from audio. See [`docs/PRD.md`](docs/PRD.md). **Hosted production** targets the shared self-hosting platform described in **§5.15** (Coolify, Traefik/Caddy, Postgres, Redis, MinIO, Stripe, shared auth—see linked platform PRD there).

## Stack

| Layer    | Choice | Notes |
|----------|--------|--------|
| Backend  | **FastAPI** | Async-friendly, OpenAPI docs, fits Python ML workers (WhisperX) later. |
| Frontend | **React + Vite + TypeScript** | Strong ecosystem for **i18n** (EN/ES), auth, and admin UI; fast dev UX. |

Alternatives considered: **Next.js** if you need SSR for marketing pages; **Svelte/Vue** are fine but React has the widest library coverage for billing and admin patterns.

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
backend/    # Python package `app`, FastAPI
frontend/   # Vite React SPA
docs/       # PRD
```
