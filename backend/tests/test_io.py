from pathlib import Path

from app.transcription.io import resolve_transcript_path


def test_resolve_transcript_path_no_collision(tmp_path: Path) -> None:
    p = resolve_transcript_path(tmp_path, "interview")
    assert p == tmp_path / "interview_transcript.txt"


def test_resolve_transcript_path_collision_suffix(tmp_path: Path) -> None:
    (tmp_path / "interview_transcript.txt").write_text("x", encoding="utf-8")
    p = resolve_transcript_path(tmp_path, "interview")
    assert p == tmp_path / "interview_transcript_1.txt"
