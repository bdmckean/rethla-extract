"""Defaults tuned for Spanish-primary audio with possible Catalan (see PRD §5.9)."""

# Multilingual Whisper; handles Spanish and Catalan in-vocabulary.
DEFAULT_WHISPER_MODEL = "large-v3"

# Default ASR language for Phase 1: Spanish-first test corpus; use --language auto for full detection.
DEFAULT_TRANSCRIBE_LANGUAGE = "es"
