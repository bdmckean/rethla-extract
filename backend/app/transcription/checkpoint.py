"""Save/load aligned transcription state so diarization can be retried without re-running ASR."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

CHECKPOINT_VERSION = 1


def _sanitize(obj: Any) -> Any:
    """Make WhisperX result structures JSON-safe (numpy scalars, etc.)."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.floating, float)):
        return float(obj)
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    return obj


def save_after_align(path: Path, *, input_audio: Path, result: dict[str, Any], detected_language: str | None) -> None:
    """Persist state after forced alignment, before diarization."""
    payload = {
        "version": CHECKPOINT_VERSION,
        "input_audio": str(input_audio.resolve()),
        "detected_language": detected_language,
        "result": _sanitize(result),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=0), encoding="utf-8")


def load_after_align(path: Path) -> tuple[Path, str | None, dict[str, Any]]:
    """Return (input_audio, detected_language, result_dict) for diarize + assign_word_speakers."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("version") != CHECKPOINT_VERSION:
        msg = f"Unsupported checkpoint version: {data.get('version')}"
        raise ValueError(msg)
    audio = Path(data["input_audio"])
    return audio, data.get("detected_language"), data["result"]
