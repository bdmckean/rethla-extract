# Transcript frontend (React + Vite + TypeScript)

## Why this stack

- **React** — large ecosystem; fits auth, billing, and **i18n** (e.g. `react-i18next`) from the PRD.
- **Vite** — fast dev server and builds.
- **TypeScript** — safer integration with the FastAPI **OpenAPI** client later.

## Setup

```bash
npm install
```

## Run (with API proxy)

1. Start the backend on port **8000** (see `../backend/README.md`).
2. Start Vite:

```bash
npm run dev
```

Open http://localhost:5173 — requests to `/api/*` are proxied to the FastAPI server.
