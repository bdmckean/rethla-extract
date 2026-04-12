"""Phase 1 CLI: transcribe a single audio file to a directory."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Annotated

import typer
from dotenv import load_dotenv

from app.transcription.constants import DEFAULT_TRANSCRIBE_LANGUAGE, DEFAULT_WHISPER_MODEL
from app.transcription.emit import format_full_transcript
from app.transcription.io import ensure_output_dir, resolve_transcript_path
from app.transcription.timings_log import append_timings_row, utc_now_iso

load_dotenv()

cli_app = typer.Typer(no_args_is_help=True, add_completion=False)


def _configure_logging(*, verbose: bool, quiet: bool) -> None:
    if quiet:
        level = logging.WARNING
    elif verbose:
        level = logging.DEBUG
    else:
        level = logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
        force=True,
    )
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


@cli_app.command()
def main(
    input_audio: Annotated[
        Path,
        typer.Argument(help="Path to source audio file.", exists=True, dir_okay=False),
    ],
    output_dir: Annotated[
        Path,
        typer.Argument(help="Directory for the transcript file (created if missing)."),
    ],
    language: Annotated[
        str,
        typer.Option(
            "--language",
            "-l",
            help=(
                "Spoken language for ASR: 'es' (default, Spanish-primary including mixed Catalan), "
                "'auto' (detect from first ~30s), or an ISO code supported by Whisper (e.g. ca)."
            ),
        ),
    ] = DEFAULT_TRANSCRIBE_LANGUAGE,
    locale: Annotated[
        str,
        typer.Option(
            "--locale",
            help="Language for transcript header labels: 'es' or 'en'.",
        ),
    ] = "es",
    model: Annotated[
        str,
        typer.Option("--model", "-m", help="Whisper model name (multilingual recommended)."),
    ] = DEFAULT_WHISPER_MODEL,
    batch_size: Annotated[int, typer.Option(help="Transcribe batch size (lower if GPU OOM).")] = 16,
    compute_type: Annotated[
        str,
        typer.Option(help="Whisper compute type: default, float16, float32, int8 (CPU-friendly)."),
    ] = "default",
    min_speakers: Annotated[
        int | None,
        typer.Option(help="Optional hint for diarization."),
    ] = None,
    max_speakers: Annotated[
        int | None,
        typer.Option(help="Optional hint for diarization."),
    ] = None,
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Debug logging (per-segment progress from WhisperX)."),
    ] = False,
    quiet: Annotated[
        bool,
        typer.Option("--quiet", "-q", help="Only warnings and errors (no progress)."),
    ] = False,
    resume: Annotated[
        Path | None,
        typer.Option(
            "--resume",
            help=(
                "Checkpoint JSON from a run that completed alignment (e.g. "
                "<stem>_after_align.json). Skips transcribe/align; runs diarization only. "
                "Use the same INPUT_AUDIO as the original run."
            ),
        ),
    ] = None,
    timings_log: Annotated[
        Path | None,
        typer.Option(
            "--timings-log",
            help=(
                "Append one CSV row with phase timings (opens in Excel/Sheets). "
                "Default: <output_dir>/extraction_timings.csv (use --no-timings-log to skip)."
            ),
        ),
    ] = None,
    no_timings_log: Annotated[
        bool,
        typer.Option(
            "--no-timings-log",
            help="Do not append to the extraction timings CSV.",
        ),
    ] = False,
) -> None:
    """Write a speaker-attributed transcript for one audio file."""
    if verbose and quiet:
        typer.secho("Use only one of --verbose or --quiet", err=True)
        raise typer.Exit(code=2)
    _configure_logging(verbose=verbose, quiet=quiet)
    log = logging.getLogger("transcript")

    transcribe_language: str | None = None if language.lower() == "auto" else language
    if locale not in ("es", "en"):
        typer.secho("locale must be 'es' or 'en'", err=True)
        raise typer.Exit(code=2)

    if not os.environ.get("HF_TOKEN") and not os.environ.get("HUGGINGFACE_TOKEN"):
        typer.secho(
            "Missing HF_TOKEN (or HUGGINGFACE_TOKEN). Diarization requires a Hugging Face token. "
            "See backend/.env.example.",
            err=True,
        )
        raise typer.Exit(code=2)

    ensure_output_dir(output_dir)
    out_path = resolve_transcript_path(output_dir, input_audio.stem)

    from app.transcription.pipeline import run_pipeline, run_pipeline_resume_from_align

    try:
        if resume is not None:
            if not resume.is_file():
                typer.secho(f"Checkpoint not found: {resume}", err=True)
                raise typer.Exit(code=2)
            result = run_pipeline_resume_from_align(
                input_audio,
                resume,
                min_speakers=min_speakers,
                max_speakers=max_speakers,
                logger=log,
            )
        else:
            ck_path = output_dir / f"{input_audio.stem}_after_align.json"
            result = run_pipeline(
                input_audio,
                whisper_model=model,
                compute_type=compute_type,
                batch_size=batch_size,
                transcribe_language=transcribe_language,
                min_speakers=min_speakers,
                max_speakers=max_speakers,
                logger=log,
                align_checkpoint_out=ck_path,
            )
    except Exception as e:
        typer.secho(str(e), err=True)
        raise typer.Exit(code=1) from e

    text = format_full_transcript(
        segments=result.segments,
        locale=locale,
        detected_language=result.detected_language,
    )
    out_path.write_text(text, encoding="utf-8")
    typer.echo(f"Wrote {out_path}")

    if not no_timings_log and result.timings is not None:
        csv_path = timings_log if timings_log is not None else (output_dir / "extraction_timings.csv")
        t = result.timings
        append_timings_row(
            csv_path,
            {
                "utc_iso": utc_now_iso(),
                "mode": t.mode,
                "input_audio": str(input_audio.resolve()),
                "audio_duration_min": round(t.audio_duration_sec / 60.0, 4),
                "device": t.device,
                "model": t.model,
                "whisper_load_sec": round(t.whisper_load_sec, 3),
                "transcribe_sec": round(t.transcribe_sec, 3),
                "align_sec": round(t.align_sec, 3),
                "diarize_sec": round(t.diarize_sec, 3),
                "assign_sec": round(t.assign_sec, 3),
                "pipeline_total_sec": round(t.pipeline_total_sec, 3),
                "detected_language": result.detected_language or "",
                "transcript_path": str(out_path.resolve()),
                "segment_count": t.segment_count,
            },
        )
        log.info("Appended timings row to %s", csv_path)


if __name__ == "__main__":
    cli_app()
