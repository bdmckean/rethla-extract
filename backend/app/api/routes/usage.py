"""Usage history and simple session-level stats."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Header, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select

from app.db import SessionLocal
from app.models import ExtractionRun

router = APIRouter(tags=["usage"])


class RunItem(BaseModel):
    id: str
    job_id: str
    source_name: str
    source_size_bytes: int | None
    source_path: str | None
    output_name: str | None
    output_path: str | None
    output_dir: str
    locale: str
    status: str
    error_message: str | None
    elapsed_sec: float | None
    completed_at: datetime | None


class RunSummary(BaseModel):
    total_runs: int
    completed_runs: int
    failed_runs: int
    total_source_bytes: int
    total_elapsed_sec: float


@router.get("/runs")
def list_runs(
    limit: int = Query(20, ge=1, le=200),
    x_client_session: str | None = Header(default=None),
) -> dict[str, list[RunItem] | RunSummary]:
    session_id = (x_client_session or "").strip() or "anonymous"
    with SessionLocal() as db:
        runs = db.scalars(
            select(ExtractionRun)
            .where(ExtractionRun.session_id == session_id)
            .order_by(desc(ExtractionRun.completed_at), desc(ExtractionRun.created_at))
            .limit(limit)
        ).all()

        total_runs = db.scalar(
            select(func.count()).select_from(ExtractionRun).where(ExtractionRun.session_id == session_id)
        )
        completed_runs = db.scalar(
            select(func.count())
            .select_from(ExtractionRun)
            .where(ExtractionRun.session_id == session_id, ExtractionRun.status == "completed")
        )
        failed_runs = db.scalar(
            select(func.count())
            .select_from(ExtractionRun)
            .where(ExtractionRun.session_id == session_id, ExtractionRun.status == "failed")
        )
        total_source_bytes = db.scalar(
            select(func.coalesce(func.sum(ExtractionRun.source_size_bytes), 0)).where(
                ExtractionRun.session_id == session_id
            )
        )
        total_elapsed_sec = db.scalar(
            select(func.coalesce(func.sum(ExtractionRun.elapsed_sec), 0.0)).where(
                ExtractionRun.session_id == session_id
            )
        )

    return {
        "items": [RunItem.model_validate(run, from_attributes=True) for run in runs],
        "summary": RunSummary(
            total_runs=int(total_runs or 0),
            completed_runs=int(completed_runs or 0),
            failed_runs=int(failed_runs or 0),
            total_source_bytes=int(total_source_bytes or 0),
            total_elapsed_sec=float(total_elapsed_sec or 0.0),
        ),
    }
