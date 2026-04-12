from app.transcription.emit import (
    format_full_transcript,
    format_header,
)


def test_format_header_spanish() -> None:
    h = format_header(locale="es", num_speakers=2, detected_language="es")
    assert "Número de hablantes: 2" in h
    assert "Idioma detectado: es" in h


def test_format_full_transcript_spanish() -> None:
    segments = [
        {
            "start": 0.0,
            "end": 1.5,
            "text": "Hola",
            "speaker": "SPEAKER_00",
        },
        {
            "start": 1.5,
            "end": 3.0,
            "text": "Què tal",
            "speaker": "SPEAKER_01",
        },
    ]
    out = format_full_transcript(segments=segments, locale="es", detected_language="es")
    assert "Hablante 1" in out
    assert "Hablante 2" in out
    assert "Hola" in out
