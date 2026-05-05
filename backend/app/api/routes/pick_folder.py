"""Host-native folder picker for local dev (browser + API on same machine)."""

from __future__ import annotations

import ipaddress
import logging
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter(tags=["system"])


class PickFolderResponse(BaseModel):
    path: str | None
    cancelled: bool


class MkdirSubfolderBody(BaseModel):
    parent_dir: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=255)


class MkdirSubfolderResponse(BaseModel):
    path: str


_NAME_RE = re.compile(r"^[^/\\\x00]+$")


def _safe_single_segment_name(name: str) -> str:
    n = name.strip()
    if not n or n in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid folder name.")
    if not _NAME_RE.match(n):
        raise HTTPException(
            status_code=400,
            detail="Use a single folder name (no slashes or path separators).",
        )
    return n


def _mkdir_subfolder_resolved(parent_dir: str, name: str) -> Path:
    raw_parent = Path(parent_dir.strip()).expanduser()
    try:
        parent_res = raw_parent.resolve(strict=True)
    except OSError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Parent directory is not accessible: {e!s}",
        ) from e
    if not parent_res.is_dir():
        raise HTTPException(status_code=400, detail="Parent path is not a directory.")
    safe = _safe_single_segment_name(name)
    child = (parent_res / safe).resolve()
    try:
        child.relative_to(parent_res)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid folder path.") from e
    try:
        child.mkdir(parents=False, exist_ok=True)
    except OSError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not create folder: {e!s}",
        ) from e
    if not child.is_dir():
        raise HTTPException(status_code=400, detail="Path exists but is not a directory.")
    return child


def _is_loopback_host(host: str | None) -> bool:
    if host is None:
        return False
    h = host.strip().lower()
    if h == "localhost":
        return True
    try:
        return ipaddress.ip_address(h).is_loopback
    except ValueError:
        return False


def _require_loopback(request: Request) -> None:
    client = request.client
    if not _is_loopback_host(client.host if client else None):
        raise HTTPException(
            status_code=403,
            detail="Folder picker is only available for loopback clients (local dev).",
        )


Loopback = Annotated[None, Depends(_require_loopback)]


def _pick_folder_darwin() -> str | None:
    script = [
        "osascript",
        "-e",
        'try',
        "-e",
        'POSIX path of (choose folder with prompt "Select output folder for transcripts")',
        "-e",
        "on error number -128",
        "-e",
        'return ""',
        "-e",
        "end try",
    ]
    try:
        r = subprocess.run(
            script,
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except OSError as e:
        log.warning("osascript failed: %s", e)
        raise HTTPException(
            status_code=501,
            detail="Could not run macOS folder dialog (osascript).",
        ) from e
    if r.returncode != 0:
        log.warning("osascript exit %s: %s", r.returncode, r.stderr.strip())
        raise HTTPException(
            status_code=501,
            detail="Folder dialog failed on macOS.",
        )
    out = (r.stdout or "").strip()
    if not out:
        return None
    return out.rstrip("/")


def _pick_folder_linux() -> str | None:
    zenity = shutil.which("zenity")
    if not zenity:
        raise HTTPException(
            status_code=501,
            detail="Install zenity for a folder picker on Linux, or enter the path manually.",
        )
    try:
        r = subprocess.run(
            [
                zenity,
                "--file-selection",
                "--directory",
                "--title=Select output folder for transcripts",
            ],
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except OSError as e:
        log.warning("zenity failed: %s", e)
        raise HTTPException(
            status_code=501,
            detail="Could not run zenity folder dialog.",
        ) from e
    if r.returncode != 0:
        return None
    out = (r.stdout or "").strip()
    return out or None


@router.post("/pick-folder", response_model=PickFolderResponse)
def pick_folder(_: Loopback) -> PickFolderResponse:
    """Open a native folder dialog on the API host. Only for local development."""
    if sys.platform == "darwin":
        path = _pick_folder_darwin()
    elif sys.platform.startswith("linux"):
        path = _pick_folder_linux()
    else:
        raise HTTPException(
            status_code=501,
            detail=f"Folder picker is not implemented for {sys.platform}. Enter the path manually.",
        )
    if path is None:
        return PickFolderResponse(path=None, cancelled=True)
    return PickFolderResponse(path=path, cancelled=False)


@router.post("/mkdir-subfolder", response_model=MkdirSubfolderResponse)
def mkdir_subfolder(_: Loopback, body: MkdirSubfolderBody) -> MkdirSubfolderResponse:
    """Create a single subfolder under an existing directory (local dev; loopback only)."""
    path = _mkdir_subfolder_resolved(body.parent_dir, body.name)
    return MkdirSubfolderResponse(path=str(path))
