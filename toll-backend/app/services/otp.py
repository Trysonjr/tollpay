import hashlib
import secrets
from datetime import timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError
from app.models import OtpCode, utcnow
from app.services import outbox


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def create_otp(db: Session, phone_number: str, purpose: str):
    now = utcnow()

    last = (db.query(OtpCode)
              .filter(OtpCode.phone_number == phone_number, OtpCode.purpose == purpose)
              .order_by(OtpCode.created_at.desc()).first())
    if last and now - last.created_at < timedelta(seconds=settings.OTP_RESEND_COOLDOWN):
        raise AppError("OTP_RESEND_TOO_SOON",
                       f"Please wait {settings.OTP_RESEND_COOLDOWN}s before requesting another code", 429)

    recent = (db.query(OtpCode)
                .filter(OtpCode.phone_number == phone_number,
                        OtpCode.created_at > now - timedelta(hours=1)).count())
    if recent >= settings.OTP_HOURLY_LIMIT:
        raise AppError("RATE_LIMITED", "Too many OTP requests this hour", 429)

    code = f"{secrets.randbelow(1000000):06d}"
    db.add(OtpCode(phone_number=phone_number, code_hash=_hash(code), purpose=purpose,
                   expires_at=now + timedelta(seconds=settings.OTP_EXPIRE_SECONDS)))
    outbox.send_otp(db, phone_number, code, purpose)


def verify_otp(db: Session, phone_number: str, code: str, purpose: str) -> OtpCode:
    otp = (db.query(OtpCode)
             .filter(OtpCode.phone_number == phone_number, OtpCode.purpose == purpose,
                     OtpCode.consumed == False)  # noqa: E712
             .order_by(OtpCode.created_at.desc()).first())
    now = utcnow()
    if not otp:
        raise AppError("INVALID_OTP", "No active code — request a new one", 400)
    if otp.expires_at < now:
        raise AppError("OTP_EXPIRED", "Code has expired — request a new one", 400)
    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise AppError("OTP_MAX_ATTEMPTS", "Too many wrong attempts — request a new code", 400)
    if otp.code_hash != _hash(code):
        otp.attempts += 1
        db.commit()
        raise AppError("INVALID_OTP", "Incorrect code", 400)
    otp.consumed = True
    return otp