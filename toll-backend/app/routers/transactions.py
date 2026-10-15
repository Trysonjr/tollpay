from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError
from app.models import Gate, Transaction, User, Vehicle
from app.schemas.common import ok
from app.security import get_current_user
from app.utils import paginate

router = APIRouter(prefix="/transactions", tags=["transactions"])


def transaction_payload(db: Session, t: Transaction) -> dict:
    vehicle = db.get(Vehicle, t.vehicle_id)
    gate = db.get(Gate, t.gate_id)
    return {
        "transaction_id": str(t.transaction_id),
        "source": t.source,
        "gate": {"gate_id": str(t.gate_id), "name": gate.name if gate else None},
        "vehicle": {"vehicle_id": str(t.vehicle_id),
                    "plate_number": vehicle.plate_number if vehicle else None},
        "vehicle_class": vehicle.vehicle_class if vehicle else None,
        "base_fee": t.base_fee,
        "discount_type": t.discount_type,
        "discount_amount": t.discount_amount,
        "amount": t.amount,
        "payment_method": t.payment_method,
        "status": t.status,
        "timestamp": t.captured_at.isoformat(),
    }


def parse_dt(s: str, field: str) -> datetime:
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        raise AppError("VALIDATION_ERROR", f"Invalid {field} date — use ISO 8601", 400)
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


# T1
@router.get("")
def list_transactions(page: int = 1, limit: int = 20,
                      vehicle_id: str | None = None,
                      date_from: str | None = Query(None, alias="from"),
                      date_to: str | None = Query(None, alias="to"),
                      user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    q = (db.query(Transaction)
           .join(Vehicle, Transaction.vehicle_id == Vehicle.vehicle_id)
           .filter(Vehicle.account_id == user.account.account_id))

    if vehicle_id:
        q = q.filter(Transaction.vehicle_id == vehicle_id)
    if date_from:
        q = q.filter(Transaction.captured_at >= parse_dt(date_from, "from"))
    if date_to:
        q = q.filter(Transaction.captured_at <= parse_dt(date_to, "to"))

    q = q.order_by(Transaction.captured_at.desc())
    items, pagination = paginate(q, page, limit)
    return ok({"items": [transaction_payload(db, t) for t in items],
               "pagination": pagination})