import re
import secrets
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import AppError
from app.models import (Account, Gate, Notification, PrepaidPass, Tariff,
                        Topup, User, utcnow)
from app.routers.gate import DISCOUNT_RATES
from app.schemas.common import ok
from app.schemas.wallet import PassPurchase, TopupInitiate
from app.security import get_current_user
from app.services import outbox
from app.services.topups import resolve_topup
from app.utils import paginate

router = APIRouter(prefix="/wallet", tags=["wallet"])

PHONE_CHECK = re.compile(r"^\+[1-9]\d{7,14}$")


def new_reference(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(3).upper()}"


def topup_expired(t: Topup) -> bool:
    return t.created_at + timedelta(seconds=settings.MOMO_EXPIRE_SECONDS) < utcnow()


def topup_payload(t: Topup, balance: int | None = None) -> dict:
    data = {
        "topup_id": str(t.topup_id), "reference": t.reference, "amount": t.amount,
        "provider": t.provider, "phone_number": t.phone_number, "status": t.status,
        "created_at": t.created_at.isoformat(),
    }
    if balance is not None:
        data["balance"] = balance
    return data


def pass_payload(p: PrepaidPass, gate_name: str, balance: int | None = None) -> dict:
    data = {
        "pass_id": str(p.pass_id),
        "gate": {"gate_id": str(p.gate_id), "name": gate_name},
        "vehicle_class": p.vehicle_class, "amount_paid": p.amount_paid,
        "status": p.status, "purchased_at": p.purchased_at.isoformat(),
        "redeemed_at": p.redeemed_at.isoformat() if p.redeemed_at else None,
        "redeemed_transaction_id": (str(p.redeemed_transaction_id)
                                    if p.redeemed_transaction_id else None),
    }
    if balance is not None:
        data["balance"] = balance
    return data


# W1
@router.get("")
def wallet(user: User = Depends(get_current_user)):
    acct = user.account
    return ok({"account_id": str(acct.account_id), "balance": acct.balance,
               "currency": "ZMW", "low_balance_threshold": acct.low_balance_threshold})


# W2
@router.post("/topup/initiate")
def initiate_topup(body: TopupInitiate, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    phone = body.phone_number or user.phone_number
    if not PHONE_CHECK.match(phone):
        raise AppError("VALIDATION_ERROR",
                       "phone_number must be E.164 format, e.g. +260971234567", 400)
    ref = new_reference("TOP")
    topup = Topup(account_id=user.account.account_id, reference=ref,
                  amount=body.amount, provider=body.provider, phone_number=phone)
    db.add(topup)
    outbox.send_momo_prompt(db, phone, ref, body.amount, body.provider)
    db.commit()
    db.refresh(topup)
    return ok(topup_payload(topup))


# W3
@router.get("/topup/{topup_id}")
def topup_status(topup_id: str, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    try:
        tid = uuid.UUID(topup_id)
    except ValueError:
        raise AppError("VALIDATION_ERROR", "Invalid topup_id format", 400)
    t = db.get(Topup, tid)
    if not t or t.account_id != user.account.account_id:
        raise AppError("NOT_FOUND", "Top-up not found", 404)
    if t.status == "pending" and topup_expired(t):
        resolve_topup(db, t, "timeout")
        db.commit()
        db.refresh(t)
    return ok(topup_payload(t,
                            balance=user.account.balance if t.status == "completed" else None))


# W4
@router.get("/topups")
def topup_history(page: int = 1, limit: int = 20,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = (db.query(Topup).filter(Topup.account_id == user.account.account_id)
           .order_by(Topup.created_at.desc()))
    items, pagination = paginate(q, page, limit)
    return ok({"items": [topup_payload(t) for t in items], "pagination": pagination})


# W5 — buy a prepaid toll pass (pay in advance, redeemed automatically at the gate)
@router.post("/passes")
def buy_pass(body: PassPurchase, user: User = Depends(get_current_user),
             db: Session = Depends(get_db)):
    try:
        gate_id = uuid.UUID(body.gate_id)
    except ValueError:
        raise AppError("VALIDATION_ERROR", "Invalid gate_id", 400)
    gate = db.get(Gate, gate_id)
    if not gate or gate.status != "active":
        raise AppError("NOT_FOUND", "Gate not found", 404)
    tariff = db.query(Tariff).filter_by(gate_id=gate_id,
                                        vehicle_class=body.vehicle_class).first()
    if not tariff:
        raise AppError("NOT_FOUND",
                       f"No tariff for {body.vehicle_class} at {gate.name}", 404)

    fee = tariff.base_fee - int(tariff.base_fee
                                * DISCOUNT_RATES.get(tariff.discount_type, 0.0))
    account = user.account
    if account.status != "active":
        raise AppError("ACCOUNT_SUSPENDED", "This account is suspended", 403)

    rows = (db.query(Account)
              .filter(Account.account_id == account.account_id,
                      Account.balance >= fee)
              .update({Account.balance: Account.balance - fee},
                      synchronize_session=False))
    if not rows:
        raise AppError("INSUFFICIENT_FUNDS",
                       "Not enough wallet balance for this pass — top up first.", 422)

    pas = PrepaidPass(account_id=account.account_id, gate_id=gate_id,
                      vehicle_class=body.vehicle_class, amount_paid=fee)
    db.add(pas)
    db.add(Notification(
        user_id=account.user_id, type="alert", title="Toll pass purchased",
        body=(f"A {body.vehicle_class.replace('_', ' ')} pass for {gate.name} was "
              f"purchased for ZMW {fee / 100:.2f}. It will be used automatically "
              f"at your next passage through that plaza.")))
    db.commit()
    db.refresh(pas)
    new_balance = (db.query(Account.balance)
                     .filter(Account.account_id == account.account_id).scalar())
    return ok(pass_payload(pas, gate.name, balance=new_balance))


# W6 — list my passes
@router.get("/passes")
def list_passes(user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    rows = (db.query(PrepaidPass, Gate)
              .join(Gate, PrepaidPass.gate_id == Gate.gate_id)
              .filter(PrepaidPass.account_id == user.account.account_id)
              .order_by(PrepaidPass.purchased_at.desc()).all())
    return ok([pass_payload(p, g.name) for p, g in rows])