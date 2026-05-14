from __future__ import annotations

import sys

import typer

from app.auth import hash_password, normalize_email
from app.db import SessionLocal, init_db
from app.models import User


def create_admin_cmd(
    email: str = typer.Option(..., "--email", "-e", help="Admin user email"),
    password: str = typer.Option(
        ...,
        "--password",
        "-p",
        help="Admin password (min 8 characters; same rule as /api/auth)",
    ),
) -> None:
    if len(password) < 8:
        typer.echo("error: password must be at least 8 characters", err=True)
        raise typer.Exit(code=1)

    normalized = normalize_email(email)
    init_db()
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == normalized).one_or_none()
        if user is None:
            user = User(
                email=normalized,
                password_hash=hash_password(password),
                role="admin",
                status="active",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            typer.echo(f"Created admin user: {user.email} ({user.id})")
            return
        user.role = "admin"
        user.status = "active"
        user.password_hash = hash_password(password)
        db.commit()
        typer.echo(f"Promoted existing user to admin: {user.email} ({user.id})")


def _strip_accidental_cli_tokens(argv: list[str]) -> list[str]:
    """Drop repeated `run` / `create-admin` tokens from bad copy-paste."""
    junk = {"run", "create-admin"}
    i = 1
    strips = 0
    while i < len(argv) and strips < 10 and argv[i] in junk:
        i += 1
        strips += 1
    # Common typo: partial third "run" → lone `r`
    if i < len(argv) and argv[i] == "r":
        i += 1
    return [argv[0], *argv[i:]]


def main() -> None:
    sys.argv = _strip_accidental_cli_tokens(sys.argv)
    typer.run(create_admin_cmd)


if __name__ == "__main__":
    main()
