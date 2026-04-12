"""Background transcription jobs for the Phase 2 UI."""

from __future__ import annotations

import logging
import os
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.transcription.emit import format_full_transcript
from app.transcription.io import ensure_output_dir, resolve_transcript_path
from app.transcription.pipeline import run_pipeline

log = logging.getLogger(__name__)

router = APIRouter(tags=["jobs"])

# Rough weights for overall % (see typical CPU run: transcribe dominates).
_PHASE_ORDER = ["load_model", "transcribe", "align", "diarize", "finalize"]
_PHASE_WEIGHTS = {
    "load_model": 0.02,
    "transcribe": 0.66,
    "align": 0.02,
    "diarize": 0.28,
    "finalize": 0.02,
}


def _overall_percent(phase: str, phase_pct: float) -> float:
    if phase not in _PHASE_WEIGHTS:
        return 0.0
    idx = _PHASE_ORDER.index(phase)
    base = sum(_PHASE_WEIGHTS[p] for p in _PHASE_ORDER[:idx]) * 100.0
    return base + _PHASE_WEIGHTS[phase] * (phase_pct / 100.0)


class JobState(BaseModel):
    id: str
    status: Literal["queued", "running", "completed", "failed"]
    phase: str | None = None
    phase_percent: float = 0.0
    overall_percent: float = 0.0
    started_at: float | None = None
    elapsed_sec: float | None = None
    eta_sec: float | None = None
    error: str | None = None
    transcript_path: str | None = None


_jobs: dict[str, JobState] = {}
_jobs_lock = threading.Lock()
_run_lock = threading.Lock()


def _update_job(job_id: str, **kwargs: object) -> None:
    with _jobs_lock:
        j = _jobs.get(job_id)
        if j is None:
            return
        for k, v in kwargs.items():
            setattr(j, k, v)


def _run_job(
    job_id: str,
    temp_audio: Path,
    original_stem: str,
    output_dir: Path,
    locale: str,
) -> None:
    t0 = time.perf_counter()

    def on_progress(phase: str, pct: float) -> None:
        overall = _overall_percent(phase, pct)
        elapsed = time.perf_counter() - t0
        eta: float | None = None
        if overall > 1.0:
            eta = elapsed / (overall / 100.0) - elapsed
            if eta < 0 or eta > 864000:
                eta = None
        _update_job(
            job_id,
            phase=phase,
            phase_percent=pct,
            overall_percent=overall,
            elapsed_sec=elapsed,
            eta_sec=eta,
        )

    try:
        _update_job(job_id, status="running", started_at=t0, phase="load_model", phase_percent=0.0)
        ensure_output_dir(output_dir)
        ck_path = output_dir / f"{original_stem}_after_align.json"
        out_path = resolve_transcript_path(output_dir, original_stem)

        result = run_pipeline(
            temp_audio,
            logger=log,
            align_checkpoint_out=ck_path,
            on_progress=on_progress,
        )

        text = format_full_transcript(
            segments=result.segments,
            locale=locale if locale in ("es", "en") else "es",
            detected_language=result.detected_language,
        )
        out_path.write_text(text, encoding="utf-8")

        _update_job(
            job_id,
            status="completed",
            transcript_path=str(out_path.resolve()),
            overall_percent=100.0,
            elapsed_sec=time.perf_counter() - t0,
            eta_sec=None,
        )
    except Exception as e:
        log.exception("Job %s failed", job_id)
        _update_job(
            job_id,
            status="failed",
            error=str(e),
            elapsed_sec=time.perf_counter() - t0,
            eta_sec=None,
        )
    finally:
        try:
            temp_audio.unlink(missing_ok=True)
        except OSError:
            pass


@router.post("/")
def create_job(
    output_dir: str = Form(..., description="Absolute directory on the API host for transcripts"),
    file: UploadFile = File(..., description="One audio file"),
    locale: str = Form("es"),
) -> dict[str, str]:
    """Upload one audio file and queue extraction. Only one job runs at a time (first cut)."""
    out = Path(output_dir).expanduser().resolve()
    if not out.exists():
        raise HTTPException(status_code=400, detail=f"Output directory does not exist: {out}")
    if not out.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {out}")

    suffix = Path(file.filename or "audio").suffix or ".bin"
    job_id = str(uuid.uuid4())

    try:
        data = file.file.read()
        if len(data) < 16:
            raise HTTPException(status_code=400, detail="File too small or empty")
        fd, raw = tempfile.mkstemp(suffix=suffix)
        try:
            os.write(fd, data)
        finally:
            os.close(fd)
        temp_path = Path(raw)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not save upload: {e}") from e

    stem = Path(file.filename or "audio").stem
    with _jobs_lock:
        _jobs[job_id] = JobState(id=job_id, status="queued")

    def target() -> None:
        with _run_lock:
            _run_job(job_id, temp_path, stem, out, locale)

    threading.Thread(target=target, name=f"transcribe-{job_id}", daemon=True).start()
    return {"job_id": job_id}


@router.get("/{job_id}", response_model=JobState)
def get_job(job_id: str) -> JobState:
    with _jobs_lock:
        j = _jobs.get(job_id)
    if j is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if j.status == "running" and j.started_at is not None:
        elapsed = time.perf_counter() - j.started_at
        return j.model_copy(update={"elapsed_sec": elapsed})
    return j

