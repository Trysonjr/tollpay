from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import AppError
from app.models import Account, RefreshToken, User, utcnow
from app.schemas.auth import (ForgotPasswordRequest, LoginRequest,
                              RefreshRequest, RegisterRequest,
                              ResetPasswordRequest, VerifyOtpRequest)
from app.schemas.common import ok
from app.security import (create_access_token, get_current_user, hash_password,
                          issue_refresh_token, sha256, verify_password)
from app.services import otp as otp_service

router = APIRouter(prefix="/auth", tags=["auth"])


def user_payload(user: User) -> dict:
    acct = user.account
    return {
        "user_id": str(user.user_id),
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "email": user.email,
        "role": user.role,
        "verified": user.verified,
        "account": {
            "account_id": str(acct.account_id),
            "account_type": acct.account_type,
            "balance": acct.balance,
            "status": acct.status,
        } if acct else None,
    }


def token_payload(db: Session, user: User) -> dict:
    return {
        "access_token": create_access_token(user),
        "refresh_token": issue_refresh_token(db, user),
        "expires_in": settings.ACCESS_TOKEN_MINUTES * 60,
        "user": user_payload(user),
    }


# A1
@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.phone_number == body.phone_number).first():
        raise AppError("DUPLICATE_PHONE", "Phone number already registered", 409)
    if body.email and db.query(User).filter(User.email == body.email).first():
        raise AppError("DUPLICATE_EMAIL", "Email already registered", 409)

    user = User(
        full_name=body.full_name,
        phone_number=body.phone_number,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    user.account = Account(account_type=body.account_type,
                           organization_name=body.organization_name)
    db.add(user)
    otp_service.create_otp(db, user.phone_number, "register")
    db.commit()
    db.refresh(user)

    return ok({
        "user_id": str(user.user_id),
        "account_id": str(user.account.account_id),
        "verification_required": True,
        "otp_expires_in": settings.OTP_EXPIRE_SECONDS,
    })


# A2
@router.post("/verify-otp")
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(phone_number=body.phone_number).first()
    if not user:
        raise AppError("NOT_FOUND", "No account with that phone number", 404)
    otp_service.verify_otp(db, body.phone_number, body.code, "register")
    user.verified = True
    db.commit()
    db.refresh(user)
    return ok(token_payload(db, user))


# A3
@router.post("/resend-otp")
def resend_otp(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(phone_number=body.phone_number).first()
    if not user:
        raise AppError("NOT_FOUND", "No account with that phone number", 404)
    otp_service.create_otp(db, body.phone_number, "register")
    db.commit()
    return ok({"resent": True, "otp_expires_in": settings.OTP_EXPIRE_SECONDS})


# A4
@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if body.phone_number:
        user = db.query(User).filter_by(phone_number=body.phone_number).first()
    else:
        user = db.query(User).filter_by(email=body.email).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise AppError("INVALID_CREDENTIALS", "Invalid phone/email or password", 401)
    if not user.verified:
        raise AppError("UNVERIFIED_ACCOUNT", "Verify your account with the OTP sent to your phone", 401)
    if user.status != "active":
        raise AppError("ACCOUNT_SUSPENDED", "This account has been suspended", 403)

    return ok(token_payload(db, user))


# A5
@router.post("/refresh")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    rt = db.query(RefreshToken).filter_by(token_hash=sha256(body.refresh_token),
                                          revoked=False).first()
    if not rt or rt.expires_at < utcnow():
        raise AppError("UNAUTHORIZED", "Invalid or expired refresh token", 401)
    rt.revoked = True  # rotation: old token dies on use
    user = db.get(User, rt.user_id)
    if not user or user.status != "active":
        raise AppError("UNAUTHORIZED", "User not found or inactive", 401)
    db.commit()
    return ok(token_payload(db, user))


# A6
@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(phone_number=body.phone_number).first()
    if user:
        otp_service.create_otp(db, body.phone_number, "reset")
        db.commit()
    # Same response either way — don't reveal whether the number is registered
    return ok({"otp_sent": True})


# A7
@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(phone_number=body.phone_number).first()
    if not user:
        raise AppError("NOT_FOUND", "No account with that phone number", 404)
    otp_service.verify_otp(db, body.phone_number, body.code, "reset")
    user.password_hash = hash_password(body.new_password)
    db.query(RefreshToken).filter_by(user_id=user.user_id).update({"revoked": True})
    db.commit()
    return ok({"password_reset": True})


# A8
@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(user_payload(user))