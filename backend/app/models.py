from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="user", index=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), index=True)


class ExtractionRun(Base):
    __tablename__ = "extraction_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    source_name: Mapped[str] = mapped_column(String(512))
    source_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_dir: Mapped[str] = mapped_column(Text)
    output_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    output_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    locale: Mapped[str] = mapped_column(String(8), default="es")
    status: Mapped[str] = mapped_column(String(32), index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    elapsed_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
