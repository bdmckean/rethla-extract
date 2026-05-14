"""Authentication endpoints (register/login/logout/me)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field

from app.auth import (
    CurrentUser,
    cookie_secure_flag,
    create_user_session,
    hash_password,
    normalize_email,
    require_current_user,
    revoke_user_session,
    session_cookie_name,
    verify_password,
)
from app.db import SessionLocal
from app.models import User

router = APIRouter(tags=["auth"])


class AuthBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class MeItem(BaseModel):
    id: str
    email: str
    role: str
    status: str


def _set_session_cookie(response: Response, token: str, max_age_seconds: int) -> None:
    response.set_cookie(
        key=session_cookie_name(),
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        secure=cookie_secure_flag(),
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=session_cookie_name(), path="/")


@router.post("/register")
def register(body: AuthBody, response: Response) -> MeItem:
    email = normalize_email(body.email)
    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == email).one_or_none()
        if existing is not None:
            raise HTTPException(status_code=409, detail="User already exists")
        user = User(email=email, password_hash=hash_password(body.password), role="user", status="active")
        db.add(user)
        db.commit()
        db.refresh(user)
    token, expires_at = create_user_session(user.id)
    max_age = int((expires_at - datetime.utcnow()).total_seconds())
    _set_session_cookie(response, token, max_age_seconds=max(max_age, 60))
    return MeItem.model_validate(user, from_attributes=True)


@router.post("/login")
def login(body: AuthBody, response: Response) -> MeItem:
    email = normalize_email(body.email)
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).one_or_none()
        if user is None or not verify_password(body.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if user.status != "active":
            raise HTTPException(status_code=403, detail="User account is not active")
    token, expires_at = create_user_session(user.id)
    max_age = int((expires_at - datetime.utcnow()).total_seconds())
    _set_session_cookie(response, token, max_age_seconds=max(max_age, 60))
    return MeItem.model_validate(user, from_attributes=True)


@router.post("/logout")
def logout(
    response: Response,
    user: CurrentUser = Depends(require_current_user),
    auth_cookie: str | None = Cookie(default=None, alias="transcript_app_session"),
) -> dict[str, str]:
    del user
    if auth_cookie:
        revoke_user_session(auth_cookie)
    _clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/me")
def me(user: CurrentUser = Depends(require_current_user)) -> MeItem:
    return MeItem.model_validate(user)
