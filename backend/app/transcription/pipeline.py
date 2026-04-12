"""WhisperX: transcribe → align → diarize → assign speakers."""

from __future__ import annotations

import gc
import logging
import os
import time
from dataclasses import dataclass
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import torch

import whisperx
from whisperx.audio import SAMPLE_RATE
from whisperx.diarize import DiarizationPipeline

from app.transcription.checkpoint import save_after_align
from app.transcription.constants import DEFAULT_WHISPER_MODEL

log = logging.getLogger(__name__)


def _audio_duration_sec(audio: np.ndarray) -> float:
    return float(len(audio)) / float(SAMPLE_RATE)


def _progress_cb(
    phase: str,
    logger: logging.Logger,
    on_progress: Callable[[str, float], None] | None = None,
) -> Any:
    """Log WhisperX progress; optional ``on_progress(phase, pct_0_100)`` for UI/API."""
    last = [0.0]

    def cb(pct: float) -> None:
        if on_progress:
            on_progress(phase, float(pct))
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug("%s: %.1f%%", phase, pct)
            return
        if pct >= 100.0 or pct - last[0] >= 10.0:
            logger.info("%s: %.0f%%", phase, pct)
            last[0] = pct

    return cb


def _resolve_hf_token() -> str | None:
    return os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")


def pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


@dataclass
class TimingsSnapshot:
    """Seconds for each phase (wall clock). ``mode`` is ``full`` or ``resume``."""

    mode: str
    audio_duration_sec: float
    device: str
    model: str
    whisper_load_sec: float
    transcribe_sec: float
    align_sec: float
    diarize_sec: float
    assign_sec: float
    pipeline_total_sec: float
    segment_count: int


@dataclass
class PipelineResult:
    segments: list[dict[str, Any]]
    detected_language: str | None
    word_segments: list[Any] | None
    timings: TimingsSnapshot | None = None


def run_pipeline(
    audio_path: Path,
    *,
    whisper_model: str = DEFAULT_WHISPER_MODEL,
    device: str | None = None,
    compute_type: str = "default",
    batch_size: int = 16,
    transcribe_language: str | None = "es",
    hf_token: str | None = None,
    min_speakers: int | None = None,
    max_speakers: int | None = None,
    logger: logging.Logger | None = None,
    align_checkpoint_out: Path | None = None,
    on_progress: Callable[[str, float], None] | None = None,
) -> PipelineResult:
    """
    Run WhisperX end-to-end.

    :param transcribe_language: ASR language code (e.g. ``\"es\"`` for Spanish-primary
        audio with possible Catalan). Use ``None`` for automatic detection (first ~30s).
    :param logger: Logger for progress (defaults to this module's logger).
    :param on_progress: Optional callback ``(phase, percent)`` with phase in
        ``load_model`` | ``transcribe`` | ``align`` | ``diarize`` | ``finalize`` and percent 0–100 within that phase.
    """
    logger = logger or log
    device = device or pick_device()
    token = hf_token if hf_token is not None else _resolve_hf_token()
    if not token:
        msg = (
            "Hugging Face token required for diarization. Set HF_TOKEN or "
            "HUGGINGFACE_TOKEN, or pass hf_token=..."
        )
        raise RuntimeError(msg)

    t0 = time.perf_counter()
    logger.info("Input: %s", audio_path)
    audio = whisperx.load_audio(str(audio_path))
    dur = _audio_duration_sec(audio)
    logger.info("Loaded audio: %.1f minutes (%.0f samples @ %d Hz)", dur / 60.0, len(audio), SAMPLE_RATE)

    # Spanish-first default: lock tokenizer to Spanish unless user chose auto (None).
    asr_language = transcribe_language
    logger.info("Device=%s model=%s transcribe_language=%s", device, whisper_model, asr_language)
    logger.info("Loading Whisper ASR model…")
    if on_progress:
        on_progress("load_model", 0.0)
    t_load = time.perf_counter()
    model = whisperx.load_model(
        whisper_model,
        device,
        compute_type=compute_type,
        language=asr_language,
    )
    whisper_load_sec = time.perf_counter() - t_load
    logger.info("Whisper ASR model ready (%.1fs)", whisper_load_sec)
    if on_progress:
        on_progress("load_model", 100.0)

    transcribe_kw: dict[str, Any] = {
        "batch_size": batch_size,
        "print_progress": False,
        "progress_callback": _progress_cb("transcribe", logger, on_progress),
    }
    if transcribe_language is not None:
        transcribe_kw["language"] = transcribe_language
    logger.info("Transcribing (this step can take a long time on CPU)…")
    t_tr = time.perf_counter()
    result = model.transcribe(audio, **transcribe_kw)
    transcribe_sec = time.perf_counter() - t_tr
    detected = result.get("language")
    logger.info("Transcribe finished in %.1fs; detected_language=%s", transcribe_sec, detected)

    del model
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    lang_for_align = detected or transcribe_language or "es"
    logger.info("Loading alignment model for language=%s…", lang_for_align)
    t_al = time.perf_counter()
    align_model, metadata = whisperx.load_align_model(language_code=lang_for_align, device=device)
    aligned = whisperx.align(
        result["segments"],
        align_model,
        metadata,
        audio,
        device,
        return_char_alignments=False,
        progress_callback=_progress_cb("align", logger, on_progress),
    )
    align_sec = time.perf_counter() - t_al
    result["segments"] = aligned["segments"]
    result["word_segments"] = aligned.get("word_segments")
    logger.info("Alignment finished in %.1fs", align_sec)

    if align_checkpoint_out is not None:
        save_after_align(
            align_checkpoint_out,
            input_audio=audio_path,
            result=result,
            detected_language=detected,
        )
        logger.info("Saved align checkpoint (resume with --resume): %s", align_checkpoint_out)

    del align_model
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    logger.info("Loading diarization model…")
    diarize_model = DiarizationPipeline(token=token, device=device)
    diarize_kw: dict[str, Any] = {"progress_callback": _progress_cb("diarize", logger, on_progress)}
    if min_speakers is not None:
        diarize_kw["min_speakers"] = min_speakers
    if max_speakers is not None:
        diarize_kw["max_speakers"] = max_speakers
    t_dz = time.perf_counter()
    logger.info("Running speaker diarization…")
    diarize_df = diarize_model(audio, **diarize_kw)
    diarize_sec = time.perf_counter() - t_dz
    logger.info("Diarization finished in %.1fs", diarize_sec)
    logger.info("Assigning speakers to words…")
    if on_progress:
        on_progress("finalize", 0.0)
    t_as = time.perf_counter()
    result = whisperx.assign_word_speakers(diarize_df, result)
    assign_sec = time.perf_counter() - t_as
    if on_progress:
        on_progress("finalize", 100.0)

    del diarize_model
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    n_seg = len(result.get("segments") or [])
    pipeline_total_sec = time.perf_counter() - t0
    logger.info("Done: %d segments in %.1fs total", n_seg, pipeline_total_sec)

    timings = TimingsSnapshot(
        mode="full",
        audio_duration_sec=dur,
        device=device,
        model=whisper_model,
        whisper_load_sec=whisper_load_sec,
        transcribe_sec=transcribe_sec,
        align_sec=align_sec,
        diarize_sec=diarize_sec,
        assign_sec=assign_sec,
        pipeline_total_sec=pipeline_total_sec,
        segment_count=n_seg,
    )

    return PipelineResult(
        segments=result["segments"],
        detected_language=detected,
        word_segments=result.get("word_segments"),
        timings=timings,
    )


def run_pipeline_resume_from_align(
    audio_path: Path,
    checkpoint_path: Path,
    *,
    hf_token: str | None = None,
    device: str | None = None,
    min_speakers: int | None = None,
    max_speakers: int | None = None,
    logger: logging.Logger | None = None,
) -> PipelineResult:
    """
    Load a checkpoint saved after alignment and run diarization + speaker assignment only.

    ``audio_path`` must match the path stored in the checkpoint (same resolved path).
    """
    from app.transcription.checkpoint import load_after_align

    logger = logger or log
    device = device or pick_device()
    token = hf_token if hf_token is not None else _resolve_hf_token()
    if not token:
        msg = "Hugging Face token required for diarization. Set HF_TOKEN or HUGGINGFACE_TOKEN."
        raise RuntimeError(msg)

    ck_audio, detected, result = load_after_align(checkpoint_path)
    if ck_audio.resolve() != audio_path.resolve():
        msg = (
            f"Checkpoint audio {ck_audio} does not match input {audio_path}. "
            "Use the same source file as the original run."
        )
        raise ValueError(msg)

    t0 = time.perf_counter()
    logger.info("Resume: loaded checkpoint %s", checkpoint_path)
    logger.info("Input: %s (verified)", audio_path)
    audio = whisperx.load_audio(str(audio_path))
    dur = _audio_duration_sec(audio)
    logger.info("Loaded audio: %.1f minutes", dur / 60.0)

    logger.info("Loading diarization model…")
    diarize_model = DiarizationPipeline(token=token, device=device)
    diarize_kw: dict[str, Any] = {"progress_callback": _progress_cb("diarize", logger)}
    if min_speakers is not None:
        diarize_kw["min_speakers"] = min_speakers
    if max_speakers is not None:
        diarize_kw["max_speakers"] = max_speakers
    t_dz = time.perf_counter()
    logger.info("Running speaker diarization…")
    diarize_df = diarize_model(audio, **diarize_kw)
    diarize_sec = time.perf_counter() - t_dz
    logger.info("Diarization finished in %.1fs", diarize_sec)
    logger.info("Assigning speakers to words…")
    t_as = time.perf_counter()
    result = whisperx.assign_word_speakers(diarize_df, result)
    assign_sec = time.perf_counter() - t_as

    del diarize_model
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    n_seg = len(result.get("segments") or [])
    pipeline_total_sec = time.perf_counter() - t0
    logger.info("Resume done: %d segments in %.1fs", n_seg, pipeline_total_sec)

    timings = TimingsSnapshot(
        mode="resume",
        audio_duration_sec=dur,
        device=device,
        model="",
        whisper_load_sec=0.0,
        transcribe_sec=0.0,
        align_sec=0.0,
        diarize_sec=diarize_sec,
        assign_sec=assign_sec,
        pipeline_total_sec=pipeline_total_sec,
        segment_count=n_seg,
    )

    return PipelineResult(
        segments=result["segments"],
        detected_language=detected,
        word_segments=result.get("word_segments"),
        timings=timings,
    )
