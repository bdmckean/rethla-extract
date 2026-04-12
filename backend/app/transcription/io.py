"""Output paths and collision handling."""

from pathlib import Path


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def resolve_transcript_path(output_dir: Path, source_stem: str, suffix: str = ".txt") -> Path:
    """
    Write to ``{stem}_transcript{suffix}``. If the file exists, append _1, _2, ...
    """
    base = output_dir / f"{source_stem}_transcript{suffix}"
    if not base.exists():
        return base
    n = 1
    while True:
        candidate = output_dir / f"{source_stem}_transcript_{n}{suffix}"
        if not candidate.exists():
            return candidate
        n += 1
