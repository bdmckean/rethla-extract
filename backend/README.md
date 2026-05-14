# Transcript backend (FastAPI)

## Setup

From this directory, using [uv](https://github.com/astral-sh/uv) (recommended) or `pip`:

```bash
uv sync
# or: python -m venv .venv && source .venv/bin/activate && pip install -e .
```

## Run

```bash
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API: http://127.0.0.1:8000  
- OpenAPI: http://127.0.0.1:8000/docs  

## Phase 1 CLI

Spanish-first defaults (`--language es`, `--locale es`, model `large-v3`). See repo root `README.md`.

```bash
uv run transcript --help
uv run transcript /path/to/audio.m4a ../data/out
```

## Admin bootstrap (Phase 3 foundation)

Set an admin bootstrap token in `backend/.env`:

```bash
ADMIN_BOOTSTRAP_TOKEN=change-me
```

Then create first admin (either option):

```bash
# Option A: CLI helper (from backend/)
# Only options — do not add extra words like `run` before `--email`.
uv run create-admin --email admin@example.com --password "change-me-123"

# Same command via module (if the console script is not on PATH)
uv run python -m app.scripts.create_admin --email admin@example.com --password "change-me-123"

# Option B: API bootstrap (single-use pattern)
curl -X POST "http://127.0.0.1:8000/api/admin/bootstrap" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Bootstrap-Token: change-me" \
  -d '{"email":"admin@example.com","password":"change-me-123"}'
```

Sign in with `/api/auth/login` to get a session cookie, then call admin endpoints.
