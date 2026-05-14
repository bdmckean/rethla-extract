"""Background transcription jobs with backend-managed queue."""

from __future__ import annotations

import logging
import os
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.auth import CurrentUser, require_current_user
from app.db import SessionLocal
from app.models import ExtractionRun
from app.transcription.emit import format_full_transcript
from app.transcription.io import ensure_output_dir, resolve_transcript_path
from app.transcription.pipeline import run_pipeline

log = logging.getLogger(__name__)

router = APIRouter(tags=["jobs"])

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
    user_id: str | None = None
    session_id: str = ""
    source_name: str = ""
    source_size_bytes: int | None = None
    output_dir: str | None = None
    locale: str = "es"
    status: Literal["queued", "running", "completed", "failed"]
    phase: str | None = None
    phase_percent: float = 0.0
    overall_percent: float = 0.0
    started_at: float | None = None
    elapsed_sec: float | None = None
    eta_sec: float | None = None
    error: str | None = None
    transcript_path: str | None = None


class QueueState(BaseModel):
    queued_ids: list[str]
    running_id: str | None
    total_queued: int
    items: list[JobState]


class ReorderRequest(BaseModel):
    position: int = Field(ge=0)


@dataclass
class JobInput:
    temp_audio: Path
    original_stem: str
    output_dir: Path
    locale: str


_jobs: dict[str, JobState] = {}
_job_inputs: dict[str, JobInput] = {}
_queue: list[str] = []
_running_job_id: str | None = None

_jobs_lock = threading.Lock()
_queue_cv = threading.Condition(_jobs_lock)
_worker_started = False


def _update_job(job_id: str, **kwargs: object) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        for k, v in kwargs.items():
            setattr(job, k, v)


def _record_run(job: JobState) -> None:
    if not job.session_id:
        return
    output_name = Path(job.transcript_path).name if job.transcript_path else None
    with SessionLocal() as db:
        db.add(
            ExtractionRun(
                job_id=job.id,
                user_id=job.user_id,
                session_id=job.session_id,
                source_name=job.source_name or "audio",
                source_size_bytes=job.source_size_bytes,
                source_path=None,
                output_dir=job.output_dir or "",
                output_name=output_name,
                output_path=job.transcript_path,
                locale=job.locale,
                status=job.status,
                error_message=job.error,
                elapsed_sec=job.elapsed_sec,
                completed_at=datetime.utcnow(),
            )
        )
        db.commit()


def _cleanup_temp_input(job_id: str) -> None:
    with _jobs_lock:
        inp = _job_inputs.pop(job_id, None)
    if inp is None:
        return
    try:
        inp.temp_audio.unlink(missing_ok=True)
    except OSError:
        pass


def _run_job(job_id: str, inp: JobInput) -> None:
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
        ensure_output_dir(inp.output_dir)
        ck_path = inp.output_dir / f"{inp.original_stem}_after_align.json"
        out_path = resolve_transcript_path(inp.output_dir, inp.original_stem)

        result = run_pipeline(
            inp.temp_audio,
            logger=log,
            align_checkpoint_out=ck_path,
            on_progress=on_progress,
        )

        text = format_full_transcript(
            segments=result.segments,
            locale=inp.locale if inp.locale in ("es", "en") else "es",
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
        _cleanup_temp_input(job_id)
        run_to_record: JobState | None = None
        with _jobs_lock:
            finished = _jobs.get(job_id)
            if finished is not None:
                run_to_record = finished.model_copy()
                finished.session_id = ""
            global _running_job_id
            if _running_job_id == job_id:
                _running_job_id = None
        if run_to_record is not None:
            _record_run(run_to_record)


def _worker_loop() -> None:
    while True:
        with _queue_cv:
            while not _queue:
                _queue_cv.wait()
            job_id = _queue.pop(0)
            inp = _job_inputs.get(job_id)
            global _running_job_id
            _running_job_id = job_id
        if inp is None:
            _update_job(job_id, status="failed", error="Queue input missing")
            with _jobs_lock:
                _running_job_id = None
            continue
        _run_job(job_id, inp)


def _ensure_worker_started() -> None:
    global _worker_started
    with _jobs_lock:
        if _worker_started:
            return
        threading.Thread(target=_worker_loop, name="jobs-worker", daemon=True).start()
        _worker_started = True


def _snapshot_queue_state(user: CurrentUser) -> QueueState:
    with _jobs_lock:
        queued_ids = [jid for jid in _queue if _jobs.get(jid) and _jobs[jid].user_id == user.id]
        running_id = _running_job_id
        if running_id and _jobs.get(running_id) and _jobs[running_id].user_id != user.id:
            running_id = None
        item_ids = ([running_id] if running_id else []) + queued_ids
        items = []
        for job_id in item_ids:
            job = _jobs.get(job_id)
            if job is None:
                continue
            if job.status == "running" and job.started_at is not None:
                elapsed = time.perf_counter() - job.started_at
                items.append(job.model_copy(update={"elapsed_sec": elapsed}))
            else:
                items.append(job)
        return QueueState(
            queued_ids=queued_ids,
            running_id=running_id,
            total_queued=len(queued_ids),
            items=items,
        )


@router.post("/")
def create_job(
    output_dir: str = Form(..., description="Absolute directory on the API host for transcripts"),
    file: UploadFile = File(..., description="One audio file"),
    locale: str = Form("es"),
    x_client_session: str | None = Header(default=None),
    user: CurrentUser = Depends(require_current_user),
) -> dict[str, str]:
    """Upload one audio file and enqueue extraction."""
    _ensure_worker_started()

    out = Path(output_dir).expanduser().resolve()
    if out.exists() and not out.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {out}")
    ensure_output_dir(out)

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
    source_name = Path(file.filename or "audio").name
    source_size_bytes = len(data)
    session_id = (x_client_session or "").strip() or "anonymous"
    with _queue_cv:
        _jobs[job_id] = JobState(
            id=job_id,
            user_id=user.id,
            session_id=session_id,
            status="queued",
            source_name=source_name,
            source_size_bytes=source_size_bytes,
            output_dir=str(out),
            locale=locale,
        )
        _job_inputs[job_id] = JobInput(
            temp_audio=temp_path,
            original_stem=stem,
            output_dir=out,
            locale=locale,
        )
        _queue.append(job_id)
        _queue_cv.notify()

    return {"job_id": job_id, "source_name": source_name}


@router.get("/queue", response_model=QueueState)
def get_queue_state(user: CurrentUser = Depends(require_current_user)) -> QueueState:
    return _snapshot_queue_state(user)


@router.post("/{job_id}/cancel", response_model=JobState)
def cancel_job(job_id: str, user: CurrentUser = Depends(require_current_user)) -> JobState:
    with _queue_cv:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        if job.user_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        if job.status != "queued":
            raise HTTPException(status_code=409, detail="Only queued jobs can be cancelled")
        if job_id in _queue:
            _queue.remove(job_id)
        job.status = "failed"
        job.error = "Cancelled by user"
        job.elapsed_sec = 0.0
        _record_run(job)
        job.session_id = ""
    _cleanup_temp_input(job_id)
    return job


@router.post("/{job_id}/reorder", response_model=QueueState)
def reorder_job(
    job_id: str, body: ReorderRequest, user: CurrentUser = Depends(require_current_user)
) -> QueueState:
    with _queue_cv:
        if job_id not in _queue or (_jobs.get(job_id) and _jobs[job_id].user_id != user.id):
            raise HTTPException(status_code=409, detail="Only queued jobs can be reordered")
        user_queue = [jid for jid in _queue if _jobs.get(jid) and _jobs[jid].user_id == user.id]
        if job_id not in user_queue:
            raise HTTPException(status_code=409, detail="Only queued jobs can be reordered")
        _queue.remove(job_id)
        target = min(body.position, max(len(user_queue) - 1, 0))
        user_queue = [jid for jid in _queue if _jobs.get(jid) and _jobs[jid].user_id == user.id]
        if target >= len(user_queue):
            _queue.append(job_id)
        else:
            anchor = user_queue[target]
            idx = _queue.index(anchor)
            _queue.insert(idx, job_id)
    return _snapshot_queue_state(user)


@router.get("/{job_id}", response_model=JobState)
def get_job(job_id: str, user: CurrentUser = Depends(require_current_user)) -> JobState:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        if job.user_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        if job.status == "running" and job.started_at is not None:
            elapsed = time.perf_counter() - job.started_at
            return job.model_copy(update={"elapsed_sec": elapsed})
        return job

