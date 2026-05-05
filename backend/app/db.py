from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def _database_url() -> str:
    return os.environ.get("DATABASE_URL", "sqlite:///./data/app.db")


def _sqlite_connect_args(url: str) -> dict[str, bool]:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def _ensure_sqlite_parent_dir(url: str) -> None:
    if not url.startswith("sqlite:///"):
        return
    raw_path = url.removeprefix("sqlite:///")
    if raw_path == ":memory:":
        return
    db_path = Path(raw_path)
    if not db_path.is_absolute():
        db_path = Path.cwd() / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None
_engine_url: str | None = None
_session_url: str | None = None


def get_engine() -> Engine:
    global _engine, _engine_url
    url = _database_url()
    if _engine is None or _engine_url != url:
        _engine = create_engine(url, connect_args=_sqlite_connect_args(url))
        _engine_url = url
    return _engine


def SessionLocal() -> Session:
    global _session_factory, _session_url
    engine = get_engine()
    url = _database_url()
    if _session_factory is None or _session_url != url:
        _session_factory = sessionmaker(
            bind=engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
        _session_url = url
    return _session_factory()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    url = _database_url()
    _ensure_sqlite_parent_dir(url)
    Base.metadata.create_all(bind=get_engine())
