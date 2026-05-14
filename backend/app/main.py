import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, health, jobs, output, pick_folder, usage
from app.db import init_db

load_dotenv()
os.environ.setdefault("DATABASE_URL", "sqlite:///./data/app.db")

app = FastAPI(
    title="Transcript App API",
    description="Speaker-diarized transcription API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth")
app.include_router(jobs.router, prefix="/api/jobs")
app.include_router(output.router, prefix="/api/output")
app.include_router(pick_folder.router, prefix="/api/system")
app.include_router(usage.router, prefix="/api/usage")
app.include_router(admin.router, prefix="/api/admin")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "transcript-backend", "docs": "/docs"}
