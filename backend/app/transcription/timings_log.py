"""Append extraction timing rows to a CSV for batch tracking."""

from __future__ import annotations

import csv
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

FIELDNAMES = [
    "utc_iso",
    "mode",
    "input_audio",
    "audio_duration_min",
    "device",
    "model",
    "whisper_load_sec",
    "transcribe_sec",
    "align_sec",
    "diarize_sec",
    "assign_sec",
    "pipeline_total_sec",
    "detected_language",
    "transcript_path",
    "segment_count",
]


def append_timings_row(path: Path, row: dict[str, Any]) -> None:
    """Append one row; write header if the file is new."""
    path.parent.mkdir(parents=True, exist_ok=True)
    exists = path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        if not exists:
            w.writeheader()
        out = {k: row.get(k, "") for k in FIELDNAMES}
        w.writerow(out)


def utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
