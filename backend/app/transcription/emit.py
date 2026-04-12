"""Format transcript text with optional Spanish or English header labels."""

from __future__ import annotations

from typing import Any


def _speaker_label(raw: str, index: int, locale: str) -> str:
    """Map pyannote-style ids (e.g. SPEAKER_00) to human-readable labels."""
    if locale == "es":
        return f"Hablante {index}"
    return f"Speaker {index}"


def _build_speaker_map(segments: list[dict[str, Any]], locale: str) -> dict[str, str]:
    order: list[str] = []
    seen: set[str] = set()
    for seg in segments:
        sp = seg.get("speaker")
        if not sp or not isinstance(sp, str):
            continue
        if sp not in seen:
            seen.add(sp)
            order.append(sp)
    return {sid: _speaker_label(sid, i + 1, locale) for i, sid in enumerate(order)}


def format_header(
    *,
    locale: str,
    num_speakers: int,
    detected_language: str | None,
) -> str:
    if locale == "es":
        lines = [
            "---",
            f"Número de hablantes: {num_speakers}",
        ]
        if detected_language:
            lines.append(f"Idioma detectado: {detected_language}")
        lines.append("---")
        return "\n".join(lines) + "\n\n"
    lines = [
        "---",
        f"Number of speakers: {num_speakers}",
    ]
    if detected_language:
        lines.append(f"Detected language: {detected_language}")
    lines.append("---")
    return "\n".join(lines) + "\n\n"


def _fmt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60.0
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:06.3f}"
    return f"{m:02d}:{s:06.3f}"


def format_transcript_body(segments: list[dict[str, Any]], locale: str) -> str:
    speaker_map = _build_speaker_map(segments, locale)
    out_lines: list[str] = []
    for seg in segments:
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))
        text = (seg.get("text") or "").strip()
        raw_sp = seg.get("speaker")
        if isinstance(raw_sp, str) and raw_sp in speaker_map:
            label = speaker_map[raw_sp]
        elif isinstance(raw_sp, str):
            label = raw_sp
        else:
            label = _speaker_label("UNK", 1, locale)
        line = f"[{_fmt_ts(start)} - {_fmt_ts(end)}] {label}: {text}"
        out_lines.append(line)
    return "\n".join(out_lines) + ("\n" if out_lines else "")


def count_distinct_speakers(segments: list[dict[str, Any]]) -> int:
    ids: set[str] = set()
    for seg in segments:
        sp = seg.get("speaker")
        if isinstance(sp, str):
            ids.add(sp)
    return max(len(ids), 1) if ids else 1


def format_full_transcript(
    *,
    segments: list[dict[str, Any]],
    locale: str,
    detected_language: str | None,
) -> str:
    n = count_distinct_speakers(segments)
    header = format_header(locale=locale, num_speakers=n, detected_language=detected_language)
    body = format_transcript_body(segments, locale)
    return header + body
