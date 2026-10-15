from sqlalchemy.orm import Session

from app.config import settings
from app.models import MockOutbox


def _mock_only() -> bool:
    """Swap point: in production these become real SMS/provider calls."""
    return settings.APP_ENV != "production"


def send_otp(db: Session, to: str, code: str, purpose: str):
    if _mock_only():
        db.add(MockOutbox(type="otp", recipient=to,
                          payload={"code": code, "purpose": purpose}))


def send_momo_prompt(db: Session, to: str, reference: str, amount: int, provider: str):
    if _mock_only():
        db.add(MockOutbox(type="momo_prompt", recipient=to,
                          payload={"reference": reference, "amount": amount,
                                   "provider": provider}))


def send_sms(db: Session, to: str, text: str):
    if _mock_only():
        db.add(MockOutbox(type="sms", recipient=to, payload={"text": text}))