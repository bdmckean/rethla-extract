from pathlib import Path

from app.transcription.timings_log import FIELDNAMES, append_timings_row


def test_append_timings_row_creates_csv(tmp_path: Path) -> None:
    p = tmp_path / "t.csv"
    append_timings_row(
        p,
        {
            "utc_iso": "2026-01-01T00:00:00Z",
            "mode": "full",
            "input_audio": "/a/b.wav",
            "audio_duration_min": 19.0,
            "device": "cpu",
            "model": "large-v3",
            "whisper_load_sec": 10.0,
            "transcribe_sec": 3000.0,
            "align_sec": 70.0,
            "diarize_sec": 1500.0,
            "assign_sec": 1.0,
            "pipeline_total_sec": 4581.0,
            "detected_language": "es",
            "transcript_path": "/out/t.txt",
            "segment_count": 198,
        },
    )
    text = p.read_text(encoding="utf-8")
    assert "utc_iso" in text
    assert "transcribe_sec" in text
    lines = text.strip().splitlines()
    assert len(lines) == 2
    assert lines[0].split(",") == FIELDNAMES


def test_append_second_row(tmp_path: Path) -> None:
    p = tmp_path / "t.csv"
    row = {
        "utc_iso": "x",
        "mode": "full",
        "input_audio": "a",
        "audio_duration_min": 1,
        "device": "cpu",
        "model": "m",
        "whisper_load_sec": 0,
        "transcribe_sec": 0,
        "align_sec": 0,
        "diarize_sec": 0,
        "assign_sec": 0,
        "pipeline_total_sec": 0,
        "detected_language": "",
        "transcript_path": "p",
        "segment_count": 0,
    }
    append_timings_row(p, row)
    append_timings_row(p, {**row, "utc_iso": "y"})
    lines = p.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 3
