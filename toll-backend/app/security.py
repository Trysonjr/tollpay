import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import AppError
from app.models import RefreshToken, User, utcnow

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return pwd_context.verify(pw, hashed)


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def create_access_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    payload = {"sub": str(user.user_id), "role": user.role, "type": "access", "exp": exp}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def issue_refresh_token(db: Session, user: User) -> str:
    raw = secrets.token_urlsafe(48)
    db.add(RefreshToken(
        user_id=user.user_id,
        token_hash=sha256(raw),
        expires_at=utcnow() + timedelta(days=settings.REFRESH_TOKEN_DAYS),
    ))
    return raw


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
                     db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise AppError("UNAUTHORIZED", "Missing bearer token", 401)
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise AppError("UNAUTHORIZED", "Invalid or expired token", 401)
    if payload.get("type") != "access":
        raise AppError("UNAUTHORIZED", "Invalid token type", 401)
    user = db.get(User, uuid.UUID(payload["sub"]))
    if not user or user.status != "active":
        raise AppError("UNAUTHORIZED", "User not found or inactive", 401)
    return user


def require_roles(*roles: str):
    """Usage: Depends(require_roles("admin", "auditor")).
    super_admin outranks every role and always passes."""
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role == "super_admin" or user.role in roles:
            return user
        raise AppError("FORBIDDEN", f"Requires one of roles: {', '.join(roles)}", 403)
    return dep