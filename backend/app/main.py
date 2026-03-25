from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health

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


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "transcript-backend", "docs": "/docs"}
