"""List completed transcripts on disk (local dev)."""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

router = APIRouter(tags=["output"])

_SPEAKER_LINE_RE = re.compile(r"^\[[^\]]+\]\s+([^:]+):\s*")


class SpeakerRenameRequest(BaseModel):
    output_dir: str = Field(..., description="Absolute directory on API host")
    name: str = Field(..., description="Transcript file basename")
    names: dict[str, str] = Field(default_factory=dict)


def _resolve_output_file(output_dir: str, name: str) -> tuple[Path, str, Path]:
    if "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="Invalid file name")
    base = Path(output_dir).expanduser().resolve()
    if not base.is_dir():
        raise HTTPException(status_code=400, detail="Invalid output directory")
    safe_name = Path(name).name
    target = (base / safe_name).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path") from None
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return base, safe_name, target


@router.get("/list")
def list_completed(
    output_dir: str = Query(..., description="Absolute directory on the API host"),
) -> dict[str, list[dict[str, str | float]]]:
    """List ``*_transcript.txt`` files in ``output_dir``."""
    p = Path(output_dir).expanduser().resolve()
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=400, detail="Invalid output directory")
    items: list[dict[str, str | float]] = []
    for f in sorted(p.glob("*_transcript.txt")):
        try:
            st = f.stat()
            items.append(
                {
                    "name": f.name,
                    "path": str(f.resolve()),
                    "size_bytes": float(st.st_size),
                    "modified": float(st.st_mtime),
                }
            )
        except OSError:
            continue
    return {"items": items}


@router.get("/file")
def read_transcript_file(
    output_dir: str = Query(..., description="Absolute directory on the API host"),
    name: str = Query(..., description="File name only (basename), e.g. audio_transcript.txt"),
) -> FileResponse:
    """Serve a transcript as ``text/plain`` so the browser can open it in a new tab."""
    _, safe_name, target = _resolve_output_file(output_dir, name)
    return FileResponse(
        path=target,
        media_type="text/plain; charset=utf-8",
        filename=safe_name,
        content_disposition_type="inline",
    )


@router.get("/speakers")
def list_transcript_speakers(
    output_dir: str = Query(..., description="Absolute directory on the API host"),
    name: str = Query(..., description="Transcript basename"),
) -> dict[str, list[str]]:
    """Return ordered speaker labels found in transcript body lines."""
    _, _, target = _resolve_output_file(output_dir, name)
    try:
        lines = target.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not read transcript: {exc}") from exc
    speakers: list[str] = []
    seen: set[str] = set()
    for line in lines:
        m = _SPEAKER_LINE_RE.match(line.strip())
        if not m:
            continue
        label = m.group(1).strip()
        if not label or label in seen:
            continue
        seen.add(label)
        speakers.append(label)
    return {"speakers": speakers}


@router.post("/rename-speakers")
def rename_transcript_speakers(req: SpeakerRenameRequest) -> dict[str, str]:
    """
    Write a sibling transcript with user-assigned speaker names.

    Example output: ``interview_transcript_named.txt``.
    """
    _, safe_name, target = _resolve_output_file(req.output_dir, req.name)
    try:
        lines = target.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not read transcript: {exc}") from exc
    remap = {k.strip(): v.strip() for k, v in req.names.items() if k.strip() and v.strip()}
    out_lines: list[str] = []
    for line in lines:
        m = _SPEAKER_LINE_RE.match(line.strip())
        if not m:
            out_lines.append(line)
            continue
        old = m.group(1).strip()
        new = remap.get(old)
        if not new:
            out_lines.append(line)
            continue
        out_lines.append(line.replace(f"] {old}: ", f"] {new}: ", 1))
    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix or ".txt"
    out_name = f"{stem}_named{suffix}"
    out_path = target.with_name(out_name)
    try:
        out_path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not write renamed transcript: {exc}") from exc
    return {"name": out_name, "path": str(out_path.resolve())}
