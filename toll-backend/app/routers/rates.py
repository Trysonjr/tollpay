from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Gate, Tariff
from app.routers.gate import DISCOUNT_RATES
from app.schemas.common import ok

router = APIRouter(prefix="/rates", tags=["rates"])


def discounted(base: int, discount_type: str) -> int:
    rate = DISCOUNT_RATES.get(discount_type, 0.0)
    return base - int(base * rate)


@router.get("")
def toll_rates(db: Session = Depends(get_db)):
    """Public fee schedule — what the landing page and Passes screen display."""
    gates = db.query(Gate).filter_by(status="active").order_by(Gate.name).all()
    return ok({"gates": [{
        "gate_id": str(g.gate_id), "name": g.name, "route": g.route,
        "tariffs": [{
            "vehicle_class": t.vehicle_class,
            "base_fee": t.base_fee,
            "discount_type": t.discount_type,
            "fee": discounted(t.base_fee, t.discount_type),
        } for t in db.query(Tariff).filter_by(gate_id=g.gate_id)
                            .order_by(Tariff.base_fee).all()],
    } for g in gates]})