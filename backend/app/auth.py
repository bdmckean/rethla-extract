from __future__ import annotations

import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta

from fastapi import Cookie, Depends, Header, HTTPException
from pydantic import BaseModel

from app.db import SessionLocal
from app.models import User, UserSession


class CurrentUser(BaseModel):
    id: str
    email: str
    role: str
    status: str


def normalize_email(email: str) -> str:
    return email.strip().lower()


def bootstrap_token() -> str:
    return os.environ.get("ADMIN_BOOTSTRAP_TOKEN", "").strip()


def session_cookie_name() -> str:
    return "transcript_app_session"


def session_ttl_days() -> int:
    raw = os.environ.get("AUTH_SESSION_TTL_DAYS", "14").strip()
    try:
        v = int(raw)
    except ValueError:
        return 14
    return max(1, min(v, 90))


def cookie_secure_flag() -> bool:
    raw = os.environ.get("AUTH_COOKIE_SECURE", "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def get_user_by_email(email: str) -> User | None:
    normalized = normalize_email(email)
    with SessionLocal() as db:
        return db.query(User).filter(User.email == normalized).one_or_none()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(dk).decode()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, salt_b64, hash_b64 = stored.split("$", 2)
    except ValueError:
        return False
    if algo != "scrypt":
        return False
    salt = base64.urlsafe_b64decode(salt_b64.encode())
    expected = base64.urlsafe_b64decode(hash_b64.encode())
    actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=len(expected))
    return secrets.compare_digest(actual, expected)


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_user_session(user_id: str) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(48)
    token_hash = _hash_session_token(token)
    expires_at = datetime.utcnow() + timedelta(days=session_ttl_days())
    with SessionLocal() as db:
        db.add(UserSession(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
        db.commit()
    return token, expires_at


def revoke_user_session(token: str) -> None:
    token_hash = _hash_session_token(token)
    with SessionLocal() as db:
        sess = db.query(UserSession).filter(UserSession.token_hash == token_hash).one_or_none()
        if sess is not None:
            db.delete(sess)
            db.commit()


def session_to_user(token: str) -> CurrentUser | None:
    token_hash = _hash_session_token(token)
    now = datetime.utcnow()
    with SessionLocal() as db:
        sess = (
            db.query(UserSession)
            .filter(UserSession.token_hash == token_hash, UserSession.expires_at > now)
            .one_or_none()
        )
        if sess is None:
            return None
        user = db.query(User).filter(User.id == sess.user_id).one_or_none()
        if user is None or user.status != "active":
            return None
        return CurrentUser(id=user.id, email=user.email, role=user.role, status=user.status)


def require_current_user(
    auth_cookie: str | None = Cookie(default=None, alias="transcript_app_session"),
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    token: str | None = auth_cookie
    if token is None and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    current = session_to_user(token)
    if current is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return current


def require_admin(user: CurrentUser = Depends(require_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
