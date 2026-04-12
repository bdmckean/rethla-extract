from pathlib import Path

import numpy as np

from app.transcription.checkpoint import load_after_align, save_after_align


def test_save_load_roundtrip(tmp_path: Path) -> None:
    audio = tmp_path / "test audio.aac"
    audio.touch()
    result = {
        "segments": [{"start": 0.0, "end": 1.0, "text": "hola", "words": []}],
        "language": "es",
        "word_segments": [],
        "x": np.float32(0.5),
    }
    ck = tmp_path / "ck.json"
    save_after_align(ck, input_audio=audio, result=result, detected_language="es")
    loaded_audio, detected, loaded_result = load_after_align(ck)
    assert loaded_audio.resolve() == audio.resolve()
    assert detected == "es"
    assert loaded_result["language"] == "es"
    assert loaded_result["segments"][0]["text"] == "hola"
    assert loaded_result["x"] == 0.5
