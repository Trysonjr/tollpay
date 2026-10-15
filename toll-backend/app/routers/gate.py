import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import AppError
from app.models import (Account, Gate, MobileMoneyPayment, Notification,
                        PrepaidPass, Tariff, Transaction, Vehicle, Violation,
                        utcnow)
from app.schemas.common import ok
from app.schemas.gate import GateTransaction, SyncRequest, ViolationReport
from app.security import sha256
from app.services import outbox
from app.services.momo import new_payment_ref, provider_from_phone, resolve_payment

router = APIRouter(prefix="/gate", tags=["gate"])

DISCOUNT_RATES = {"none": 0.0, "frequent_user": 0.10, "local_user": 0.50, "exempt": 1.0}


# ---------- auth & helpers ----------

def get_gate(x_gate_id: str = Header(...), x_gate_key: str = Header(...),
             db: Session = Depends(get_db)) -> Gate:
    gate = None
    try:
        gate = db.get(Gate, uuid.UUID(x_gate_id))
    except ValueError:
        gate = None
    if not gate or gate.status != "active" or gate.api_key_hash != sha256(x_gate_key):
        raise AppError("GATE_KEY_INVALID", "Invalid gate credentials", 401)
    return gate


def _uuid(value: str, what: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        raise AppError("VALIDATION_ERROR", f"Invalid {what}", 400)


def _captured_at(raw: str | None) -> datetime:
    if not raw:
        return utcnow()
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise AppError("VALIDATION_ERROR", "captured_at must be ISO 8601", 400)
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _plate(raw: str | None) -> str | None:
    if not raw:
        return None
    return raw.upper().replace(" ", "").replace("-", "")


def _brief(v: Vehicle) -> dict:
    return {"vehicle_id": str(v.vehicle_id), "plate_number": v.plate_number,
            "vehicle_class": v.vehicle_class}


def _manual_lane(reason: str) -> dict:
    return {"decision": "manual_lane", "reason": reason,
            "transaction_id": None, "amount": None}


def _resolve_vehicle(db: Session, plate: str | None, tag: str | None):
    """Dual-mode identification: RFID primary, ANPR cross-check."""
    plate_v = tag_v = None
    if plate:
        plate_v = db.query(Vehicle).filter_by(plate_number=plate, status="active").first()
    if tag:
        tag_v = db.query(Vehicle).filter_by(rfid_tag_id=tag, status="active").first()
    if tag_v:
        if plate and (not plate_v or plate_v.vehicle_id != tag_v.vehicle_id):
            return None, "PLATE_TAG_MISMATCH"
        return tag_v, None
    if plate_v:
        return plate_v, None
    if plate or tag:
        return None, "VEHICLE_NOT_FOUND"
    return None, "NO_IDENTIFIER_READ"


def _tariff_for(db: Session, gate_id, vehicle_class: str):
    return db.query(Tariff).filter_by(gate_id=gate_id, vehicle_class=vehicle_class).first()


def _fee(tariff: Tariff):
    base = tariff.base_fee
    rate = DISCOUNT_RATES.get(tariff.discount_type, 0.0)
    discount = int(base * rate)
    return base, tariff.discount_type, discount, base - discount


def _find_pass(db: Session, account_id, gate_id, vehicle_class: str):
    """Oldest active prepaid pass matching this account/gate/class."""
    return (db.query(PrepaidPass)
              .filter(PrepaidPass.account_id == account_id,
                      PrepaidPass.gate_id == gate_id,
                      PrepaidPass.vehicle_class == vehicle_class,
                      PrepaidPass.status == "active")
              .order_by(PrepaidPass.purchased_at.asc()).first())


def _redeem_pass(db: Session, pas: PrepaidPass, tx: Transaction, tx_id):
    pas.status = "redeemed"
    pas.redeemed_at = utcnow()
    pas.redeemed_transaction_id = tx_id
    tx.payment_method = "prepaid_pass"
    tx.status = "paid"


def _receipt(db: Session, user_id, gate: Gate, vehicle: Vehicle, amount: int, tx_id, note=""):
    db.add(Notification(
        user_id=user_id, type="receipt", title="Toll paid",
        body=(f"ZMW {amount / 100:.2f} paid at {gate.name} for {vehicle.plate_number}."
              f" Receipt ID: {str(tx_id)[:8].upper()}.{note}")))


def _replay(db: Session, tx: Transaction) -> dict:
    """Edge retried a passage we already processed — return the same outcome."""
    if tx.status == "paid":
        return {"decision": "open", "reason": "ALREADY_PROCESSED",
                "transaction_id": str(tx.transaction_id), "amount": tx.amount,
                "payment_method": tx.payment_method, "status": tx.status,
                "vehicle": _brief(db.get(Vehicle, tx.vehicle_id))}
    p = tx.momo_payment
    if p and p.status == "pending":
        return {"decision": "momo_pending", "reason": "ALREADY_PROCESSED",
                "payment_reference": p.payment_ref,
                "poll_url": f"/gate/payments/{p.payment_ref}",
                "expires_at": p.expires_at.isoformat(), "amount": p.amount,
                "vehicle": _brief(db.get(Vehicle, tx.vehicle_id))}
    return _manual_lane("TRANSACTION_FAILED")


# ---------- G1: process one passage ----------

@router.post("/transactions")
def process_passage(body: GateTransaction, gate: Gate = Depends(get_gate),
                    db: Session = Depends(get_db)):
    tx_id = _uuid(body.transaction_id, "transaction_id")
    captured_at = _captured_at(body.captured_at)
    plate = _plate(body.plate_number)

    existing = db.get(Transaction, tx_id)          # idempotency (edge retry)
    if existing:
        return ok(_replay(db, existing))

    vehicle, reason = _resolve_vehicle(db, plate, body.rfid_tag_id)
    if not vehicle:
        return ok(_manual_lane(reason))

    account = db.get(Account, vehicle.account_id)
    if not account or account.status != "active":
        return ok(_manual_lane("ACCOUNT_SUSPENDED"))

    tariff = _tariff_for(db, gate.gate_id, vehicle.vehicle_class)
    if not tariff:
        return ok(_manual_lane("TARIFF_NOT_FOUND"))

    base_fee, discount_type, discount_amount, amount = _fee(tariff)

    tx = Transaction(transaction_id=tx_id, vehicle_id=vehicle.vehicle_id,
                     gate_id=gate.gate_id, tariff_id=tariff.tariff_id,
                     base_fee=base_fee, discount_type=discount_type,
                     discount_amount=discount_amount, amount=amount,
                     payment_method="account_balance", status="pending",
                     source="online", captured_at=captured_at)
    db.add(tx)

    # --- Path 0: redeem an active prepaid toll pass, if the account holds one ---
    if amount > 0:
        pas = _find_pass(db, vehicle.account_id, gate.gate_id, vehicle.vehicle_class)
        if pas:
            _redeem_pass(db, pas, tx, tx_id)
            _receipt(db, account.user_id, gate, vehicle, amount, tx_id, " (toll pass)")
            db.commit()
            return ok({"decision": "open", "reason": "PASS_REDEEMED",
                       "transaction_id": str(tx_id), "amount": amount,
                       "payment_method": "prepaid_pass", "status": "paid",
                       "balance_after": account.balance, "vehicle": _brief(vehicle)})

    # --- Path A: pay from balance (atomic debit guards against races) ---
    new_balance = None
    paid = False
    if amount == 0:                                 # exempt
        paid = True
    elif account.balance >= amount:
        rows = (db.query(Account)
                  .filter(Account.account_id == account.account_id,
                          Account.balance >= amount)
                  .update({Account.balance: Account.balance - amount},
                          synchronize_session=False))
        if rows:
            paid = True
            new_balance = (db.query(Account.balance)
                             .filter(Account.account_id == account.account_id).scalar())

    if paid:
        tx.status = "paid"
        reason = "EXEMPT" if amount == 0 else "PAID_FROM_BALANCE"
        _receipt(db, account.user_id, gate, vehicle, amount, tx_id)
        if new_balance is not None and new_balance < account.low_balance_threshold:
            db.add(Notification(
                user_id=account.user_id, type="low_balance", title="Low balance",
                body=(f"Your toll balance is ZMW {new_balance / 100:.2f}. "
                      f"Top up to keep using the automated lane.")))
        db.commit()
        return ok({"decision": "open", "reason": reason,
                   "transaction_id": str(tx_id), "amount": amount,
                   "payment_method": tx.payment_method, "status": "paid",
                   "balance_after": new_balance, "vehicle": _brief(vehicle)})

    # --- Path B: insufficient balance -> mobile-money PIN prompt ---
    user = account.user
    provider = provider_from_phone(user.phone_number)
    ref = new_payment_ref()
    tx.payment_method = "mobile_money"
    db.add(MobileMoneyPayment(
        payment_ref=ref, transaction_id=tx_id, provider=provider,
        phone_number=user.phone_number, amount=amount, status="pending",
        expires_at=utcnow() + timedelta(seconds=settings.MOMO_EXPIRE_SECONDS)))
    outbox.send_momo_prompt(db, user.phone_number, ref, amount, provider)
    db.commit()
    return ok({"decision": "momo_pending",
               "reason": "INSUFFICIENT_BALANCE_MOMO_INITIATED",
               "payment_reference": ref, "poll_url": f"/gate/payments/{ref}",
               "expires_at": (utcnow() + timedelta(seconds=settings.MOMO_EXPIRE_SECONDS)).isoformat(),
               "amount": amount, "vehicle": _brief(vehicle)})


# ---------- G2: poll mobile-money outcome ----------

@router.get("/payments/{reference}")
def poll_payment(reference: str, gate: Gate = Depends(get_gate),
                 db: Session = Depends(get_db)):
    p = db.get(MobileMoneyPayment, reference)
    if not p:
        raise AppError("NOT_FOUND", "Unknown payment reference", 404)
    if p.status == "pending" and p.expires_at < utcnow():   # lazy timeout
        resolve_payment(db, p, "timeout")
        db.commit()
        db.refresh(p)

    if p.status == "approved":
        return ok({"reference": p.payment_ref, "status": "approved",
                   "decision": "open", "transaction_id": str(p.transaction_id),
                   "amount": p.amount})
    if p.status in ("declined", "timeout"):
        return ok({"reference": p.payment_ref, "status": p.status,
                   "decision": "manual_lane",
                   "reason": f"MOMO_{p.status.upper()}"})
    return ok({"reference": p.payment_ref, "status": "pending",
               "decision": "momo_pending"})


# ---------- G3: offline sync (exactly-once via transaction_id) ----------

@router.post("/transactions/sync")
def sync(body: SyncRequest, gate: Gate = Depends(get_gate),
         db: Session = Depends(get_db)):
    results = []
    for item in body.transactions:
        tid = _uuid(item.transaction_id, "transaction_id")
        captured_at = _captured_at(item.captured_at)
        plate = _plate(item.plate_number)

        existing = db.get(Transaction, tid)
        if existing:
            results.append({"transaction_id": str(tid), "result": "duplicate",
                            "status": existing.status, "reason": None})
            continue

        vehicle, reason = _resolve_vehicle(db, plate, item.rfid_tag_id)
        if not vehicle:
            db.add(Violation(plate_number=plate or "UNKNOWN",
                             gate_id=gate.gate_id, captured_at=captured_at))
            results.append({"transaction_id": str(tid), "result": "accepted",
                            "status": "failed", "reason": reason})
            continue

        account = db.get(Account, vehicle.account_id)
        tariff = _tariff_for(db, gate.gate_id, vehicle.vehicle_class)
        amount = item.amount

        tx = Transaction(transaction_id=tid, vehicle_id=vehicle.vehicle_id,
                         gate_id=gate.gate_id,
                         tariff_id=tariff.tariff_id if tariff else None,
                         base_fee=tariff.base_fee if tariff else amount,
                         discount_type=tariff.discount_type if tariff else "none",
                         discount_amount=0, amount=amount,
                         payment_method="account_balance", status="pending",
                         source="offline_sync", captured_at=captured_at)
        db.add(tx)

        # redeem an active pass at settlement time, if one exists
        if amount > 0:
            pas = _find_pass(db, vehicle.account_id, gate.gate_id,
                             vehicle.vehicle_class)
            if pas:
                _redeem_pass(db, pas, tx, tid)
                _receipt(db, account.user_id, gate, vehicle, amount, tid,
                         " (toll pass, offline sync)")
                results.append({"transaction_id": str(tid), "result": "accepted",
                                "status": "paid", "reason": "PASS_REDEEMED"})
                continue

        if amount == 0 or (account and account.status == "active"
                           and account.balance >= amount):
            if amount > 0:
                db.query(Account).filter(Account.account_id == account.account_id)\
                    .update({Account.balance: Account.balance - amount},
                            synchronize_session=False)
            tx.status = "paid"
            _receipt(db, account.user_id, gate, vehicle, amount, tid,
                     " (settled from offline queue)")
            results.append({"transaction_id": str(tid), "result": "accepted",
                            "status": "paid", "reason": None})
        else:
            tx.status = "failed"
            db.add(Notification(
                user_id=account.user_id, type="low_balance",
                title="Offline payment failed",
                body=(f"A toll of ZMW {amount / 100:.2f} at {gate.name} could not be "
                      f"settled — your balance was insufficient. Please top up.")))
            results.append({"transaction_id": str(tid), "result": "accepted",
                            "status": "failed", "reason": "INSUFFICIENT_FUNDS"})

    db.commit()
    return ok({"results": results})


# ---------- G4: tariff table for the edge cache ----------

@router.get("/tariffs")
def tariffs(gate: Gate = Depends(get_gate), db: Session = Depends(get_db)):
    rows = db.query(Tariff).all()
    return ok({"tariffs": [
        {"tariff_id": str(t.tariff_id), "gate_id": str(t.gate_id),
         "vehicle_class": t.vehicle_class, "base_fee": t.base_fee,
         "discount_type": t.discount_type} for t in rows],
        "synced_at": utcnow().isoformat()})


# ---------- G5: violation report ----------

@router.post("/violations")
def report_violation(body: ViolationReport, gate: Gate = Depends(get_gate),
                     db: Session = Depends(get_db)):
    v = Violation(plate_number=_plate(body.plate_number) or "UNKNOWN",
                  gate_id=gate.gate_id, captured_at=_captured_at(body.captured_at),
                  image_ref=body.image_ref)
    db.add(v)
    db.commit()
    return ok({"violation_id": str(v.violation_id), "status": v.status})