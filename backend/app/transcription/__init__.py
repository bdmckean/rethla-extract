"""Transcription pipeline (WhisperX) and transcript formatting."""

from __future__ import annotations

from typing import Any

__all__ = ["run_pipeline"]


def __getattr__(name: str) -> Any:
    if name == "run_pipeline":
        from app.transcription.pipeline import run_pipeline as run_pipeline_fn

        return run_pipeline_fn
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
