"""List completed transcripts on disk (local dev)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

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
