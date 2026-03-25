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
