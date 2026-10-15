from io import BytesIO

import qrcode
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import AppError
from app.models import (Gate, MockOutbox, MobileMoneyPayment, Notification,
                        Tariff, Topup, Transaction, Vehicle, Violation)
from app.schemas.common import ok

router = APIRouter(prefix="/dev", tags=["dev"])


def _dev_only():
    if settings.APP_ENV == "production":
        raise AppError("NOT_FOUND", "Not available", 404)


@router.get("/outbox")
def outbox(db: Session = Depends(get_db)):
    _dev_only()
    items = (db.query(MockOutbox)
               .order_by(MockOutbox.created_at.desc())
               .limit(50).all())
    return ok([
        {"id": str(o.id), "type": o.type, "to": o.recipient,
         "payload": o.payload, "created_at": o.created_at.isoformat(),
         "expires_at": o.expires_at.isoformat() if o.expires_at else None}
        for o in items
    ])


@router.get("/gates")
def gates(db: Session = Depends(get_db)):
    _dev_only()
    items = db.query(Gate).order_by(Gate.name).all()
    return ok([{"gate_id": str(g.gate_id), "name": g.name,
                "route": g.route, "status": g.status} for g in items])


@router.get("/edge-cache")
def edge_cache(db: Session = Depends(get_db)):
    """Everything the edge controller caches locally: vehicles (with hot
    account data) + tariffs. Balances are a snapshot from sync time —
    the live settlement always happens through the gate API."""
    _dev_only()
    vehicles = (db.query(Vehicle)
                  .filter(Vehicle.status == "active")
                  .order_by(Vehicle.plate_number).all())
    tariffs = db.query(Tariff).all()

    out = []
    for v in vehicles:
        acct = v.account
        user = acct.user if acct else None
        out.append({
            "plate_number": v.plate_number,
            "rfid_tag_id": v.rfid_tag_id,
            "vehicle_class": v.vehicle_class,
            "owner": user.full_name if user else None,
            "phone": user.phone_number if user else None,
            "account": f"TP-{str(acct.account_id)[:8].upper()}" if acct else None,
            "balance": acct.balance if acct else None,
        })

    return ok({
        "vehicles": out,
        "tariffs": [{"gate_id": str(t.gate_id), "vehicle_class": t.vehicle_class,
                     "base_fee": t.base_fee, "discount_type": t.discount_type}
                    for t in tariffs],
    })


@router.post("/reset")
def reset(db: Session = Depends(get_db)):
    """Demo reset: wipes transactions, payments, violations, notifications,
    topups, audit logs and the outbox; sets every account balance to ZMW 500.
    Users, vehicles, gates, tariffs and passes are kept."""
    _dev_only()
    db.query(MobileMoneyPayment).delete()
    db.query(Transaction).delete()
    db.query(Violation).delete()
    db.query(Topup).delete()
    db.query(Notification).delete()
    db.query(MockOutbox).delete()
    db.query(Account).update({Account.balance: 50000}, synchronize_session=False) if False else None
    from app.models import Account
    db.query(Account).update({Account.balance: 50000}, synchronize_session=False)
    db.commit()
    return ok({"reset": True, "note": "All balances set to ZMW 500.00"})
@router.get("/vehicle-qr/{plate}")
def vehicle_qr(plate: str, db: Session = Depends(get_db)):
    """QR 'electronic plate sticker' for a registered vehicle."""
    _dev_only()
    v = db.query(Vehicle).filter_by(plate_number=plate.upper().replace(" ", "")).first()
    if not v:
        raise AppError("NOT_FOUND", "Vehicle not found", 404)
    payload = f"TOLLPAY:{v.plate_number}:{v.rfid_tag_id or ''}"
    img = qrcode.make(payload, box_size=10, border=2)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")