from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import AppError
from app.models import MobileMoneyPayment, Topup
from app.schemas.common import ok
from app.services.momo import resolve_payment
from app.services.topups import resolve_topup

router = APIRouter(prefix="/mock", tags=["mock"])


def _resolve(db: Session, reference: str, outcome: str) -> str:
    if settings.APP_ENV == "production":
        raise AppError("NOT_FOUND", "Not available", 404)
    if reference.startswith("TOP-"):
        t = db.query(Topup).filter_by(reference=reference).first()
        if not t:
            raise AppError("NOT_FOUND", f"No top-up with reference {reference}", 404)
        resolve_topup(db, t, outcome)
        return t.status
    if reference.startswith("PAY-"):
        p = db.query(MobileMoneyPayment).filter_by(payment_ref=reference).first()
        if not p:
            raise AppError("NOT_FOUND", f"No payment with reference {reference}", 404)
        resolve_payment(db, p, outcome)
        return p.status
    raise AppError("NOT_FOUND", "Reference must start with TOP- or PAY-", 404)


@router.post("/momo/{reference}/approve")
def approve(reference: str, db: Session = Depends(get_db)):
    status = _resolve(db, reference, "approved")
    db.commit()
    return ok({"reference": reference, "status": status})


@router.post("/momo/{reference}/decline")
def decline(reference: str, db: Session = Depends(get_db)):
    status = _resolve(db, reference, "declined")
    db.commit()
    return ok({"reference": reference, "status": status})


@router.post("/momo/{reference}/timeout")
def timeout(reference: str, db: Session = Depends(get_db)):
    status = _resolve(db, reference, "timeout")
    db.commit()
    return ok({"reference": reference, "status": status})