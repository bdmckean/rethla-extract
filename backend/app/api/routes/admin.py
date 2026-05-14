"""Admin-only endpoints for user management and visibility."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import case, desc, func, select

from app.auth import CurrentUser, bootstrap_token, hash_password, normalize_email, require_admin
from app.db import SessionLocal
from app.models import ExtractionRun, User

router = APIRouter(tags=["admin"])


class UserItem(BaseModel):
    id: str
    email: str
    role: str
    status: str
    created_at: datetime


class BootstrapBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserCreateBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = "user"


class UserRoleBody(BaseModel):
    role: str


class UsageSummaryItem(BaseModel):
    user_id: str
    email: str
    total_runs: int
    completed_runs: int
    failed_runs: int
    total_elapsed_sec: float


@router.post("/bootstrap")
def bootstrap_admin(
    body: BootstrapBody,
    x_admin_bootstrap_token: str | None = Header(default=None, alias="X-Admin-Bootstrap-Token"),
) -> dict[str, str]:
    expected = bootstrap_token()
    if not expected:
        raise HTTPException(status_code=409, detail="ADMIN_BOOTSTRAP_TOKEN not configured")
    if (x_admin_bootstrap_token or "").strip() != expected:
        raise HTTPException(status_code=403, detail="Invalid bootstrap token")
    email = normalize_email(body.email)
    with SessionLocal() as db:
        existing_admin = db.query(User).filter(User.role == "admin").first()
        if existing_admin is not None:
            raise HTTPException(status_code=409, detail="Admin already exists; use admin APIs")
        existing = db.query(User).filter(User.email == email).one_or_none()
        if existing is not None:
            existing.role = "admin"
            existing.status = "active"
            existing.password_hash = hash_password(body.password)
            db.commit()
            return {"id": existing.id, "email": existing.email, "role": existing.role}
        user = User(email=email, password_hash=hash_password(body.password), role="admin", status="active")
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"id": user.id, "email": user.email, "role": user.role}


@router.get("/users")
def list_users(_: CurrentUser = Depends(require_admin)) -> dict[str, list[UserItem]]:
    with SessionLocal() as db:
        users = db.query(User).order_by(desc(User.created_at)).all()
    return {"items": [UserItem.model_validate(u, from_attributes=True) for u in users]}


@router.post("/users")
def create_user(body: UserCreateBody, _: CurrentUser = Depends(require_admin)) -> UserItem:
    role = body.role.strip().lower()
    if role not in {"user", "admin"}:
        raise HTTPException(status_code=400, detail="role must be user or admin")
    email = normalize_email(body.email)
    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == email).one_or_none()
        if existing is not None:
            raise HTTPException(status_code=409, detail="User already exists")
        user = User(email=email, password_hash=hash_password(body.password), role=role, status="active")
        db.add(user)
        db.commit()
        db.refresh(user)
    return UserItem.model_validate(user, from_attributes=True)


@router.post("/users/{user_id}/role")
def set_user_role(user_id: str, body: UserRoleBody, _: CurrentUser = Depends(require_admin)) -> UserItem:
    role = body.role.strip().lower()
    if role not in {"user", "admin"}:
        raise HTTPException(status_code=400, detail="role must be user or admin")
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        user.role = role
        db.commit()
        db.refresh(user)
    return UserItem.model_validate(user, from_attributes=True)


@router.get("/usage-summary")
def usage_summary(_: CurrentUser = Depends(require_admin)) -> dict[str, list[UsageSummaryItem]]:
    with SessionLocal() as db:
        rows = db.execute(
            select(
                User.id.label("user_id"),
                User.email.label("email"),
                func.count(ExtractionRun.id).label("total_runs"),
                func.sum(case((ExtractionRun.status == "completed", 1), else_=0)).label(
                    "completed_runs"
                ),
                func.sum(case((ExtractionRun.status == "failed", 1), else_=0)).label(
                    "failed_runs"
                ),
                func.coalesce(func.sum(ExtractionRun.elapsed_sec), 0.0).label("total_elapsed_sec"),
            )
            .join(ExtractionRun, ExtractionRun.user_id == User.id, isouter=True)
            .group_by(User.id, User.email)
            .order_by(desc("total_runs"), User.email)
        ).all()
    items: list[UsageSummaryItem] = []
    for row in rows:
        items.append(
            UsageSummaryItem(
                user_id=row.user_id,
                email=row.email,
                total_runs=int(row.total_runs or 0),
                completed_runs=int(row.completed_runs or 0),
                failed_runs=int(row.failed_runs or 0),
                total_elapsed_sec=float(row.total_elapsed_sec or 0.0),
            )
        )
    return {"items": items}
