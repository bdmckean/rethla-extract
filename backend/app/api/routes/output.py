"""List completed transcripts on disk (local dev)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

router = APIRouter(tags=["output"])


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
    return FileResponse(
        path=target,
        media_type="text/plain; charset=utf-8",
        filename=safe_name,
        content_disposition_type="inline",
    )
