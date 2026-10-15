import secrets
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError
from app.models import (Account, AuditLog, Gate, RefreshToken, Tariff,
                        Transaction, User, Vehicle, Violation, utcnow)
from app.routers.transactions import parse_dt, transaction_payload
from app.schemas.admin import (AdminUserCreate, GateCreate, TariffCreate,
                               TariffUpdate, UserStatusUpdate)
from app.schemas.common import ok
from app.security import hash_password, require_roles, sha256
from app.services.audit import audit
from app.utils import paginate

router = APIRouter(prefix="/admin", tags=["admin"])


def _uuid(value: str, what: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        raise AppError("VALIDATION_ERROR", f"Invalid {what}", 400)


def tariff_payload(t: Tariff, gate_name: str | None = None) -> dict:
    return {"tariff_id": str(t.tariff_id), "gate_id": str(t.gate_id),
            "gate_name": gate_name, "vehicle_class": t.vehicle_class,
            "base_fee": t.base_fee, "discount_type": t.discount_type}


def user_summary(u: User) -> dict:
    return {"user_id": str(u.user_id), "full_name": u.full_name,
            "phone_number": u.phone_number, "email": u.email, "role": u.role,
            "verified": u.verified, "status": u.status,
            "created_at": u.created_at.isoformat()}


# ---------- M1: dashboard summary ----------

@router.get("/summary")
def summary(user: User = Depends(require_roles("admin", "auditor")),
            db: Session = Depends(get_db)):
    today_start = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    revenue_today = (db.query(func.sum(Transaction.amount))
                       .filter(Transaction.status == "paid",
                               Transaction.captured_at >= today_start).scalar()) or 0
    transactions_today = (db.query(Transaction)
                            .filter(Transaction.captured_at >= today_start).count())
    failed_today = (db.query(Transaction)
                      .filter(Transaction.status == "failed",
                              Transaction.captured_at >= today_start).count())
    active_vehicles = db.query(Vehicle).filter_by(status="active").count()
    open_violations = db.query(Violation).filter_by(status="open").count()
    return ok({"revenue_today": revenue_today,
               "transactions_today": transactions_today,
               "failed_payments_today": failed_today,
               "active_vehicles": active_vehicles,
               "open_violations": open_violations})


# ---------- M2/M3: tariffs ----------

@router.get("/tariffs")
def list_tariffs(user: User = Depends(require_roles("admin")),
                 db: Session = Depends(get_db)):
    rows = (db.query(Tariff, Gate)
              .join(Gate, Tariff.gate_id == Gate.gate_id)
              .order_by(Gate.name, Tariff.vehicle_class).all())
    return ok([tariff_payload(t, g.name) for t, g in rows])


@router.post("/tariffs")
def create_tariff(body: TariffCreate, user: User = Depends(require_roles("admin")),
                  db: Session = Depends(get_db)):
    gate_id = _uuid(body.gate_id, "gate_id")
    gate = db.get(Gate, gate_id)
    if not gate:
        raise AppError("NOT_FOUND", "Gate not found", 404)
    if db.query(Tariff).filter_by(gate_id=gate_id,
                                  vehicle_class=body.vehicle_class).first():
        raise AppError("DUPLICATE_TARIFF",
                       f"{gate.name} already has a tariff for {body.vehicle_class}", 409)
    t = Tariff(gate_id=gate_id, vehicle_class=body.vehicle_class,
               base_fee=body.base_fee, discount_type=body.discount_type)
    db.add(t)
    db.flush()
    audit(db, user, "TARIFF_CREATED", f"tariff:{t.tariff_id}")
    db.commit()
    db.refresh(t)
    return ok(tariff_payload(t, gate.name))


@router.patch("/tariffs/{tariff_id}")
def update_tariff(tariff_id: str, body: TariffUpdate,
                  user: User = Depends(require_roles("admin")),
                  db: Session = Depends(get_db)):
    t = db.get(Tariff, _uuid(tariff_id, "tariff_id"))
    if not t:
        raise AppError("NOT_FOUND", "Tariff not found", 404)
    if body.base_fee is not None:
        t.base_fee = body.base_fee
    if body.discount_type is not None:
        t.discount_type = body.discount_type
    audit(db, user, "TARIFF_UPDATED", f"tariff:{t.tariff_id}")
    db.commit()
    db.refresh(t)
    gate = db.get(Gate, t.gate_id)
    return ok(tariff_payload(t, gate.name if gate else None))


@router.delete("/tariffs/{tariff_id}")
def delete_tariff(tariff_id: str, user: User = Depends(require_roles("admin")),
                  db: Session = Depends(get_db)):
    t = db.get(Tariff, _uuid(tariff_id, "tariff_id"))
    if not t:
        raise AppError("NOT_FOUND", "Tariff not found", 404)
    db.delete(t)
    audit(db, user, "TARIFF_DELETED", f"tariff:{t.tariff_id}")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError("TARIFF_IN_USE",
                       "Tariff has historical transactions — update it instead of deleting", 409)
    return ok({"deleted": True})


# ---------- M4: gates ----------

@router.get("/gates")
def list_gates(user: User = Depends(require_roles("admin")),
               db: Session = Depends(get_db)):
    gates = db.query(Gate).order_by(Gate.name).all()
    return ok([{"gate_id": str(g.gate_id), "name": g.name, "route": g.route,
                "gps_location": g.gps_location, "status": g.status,
                "created_at": g.created_at.isoformat()} for g in gates])


@router.post("/gates")
def create_gate(body: GateCreate, user: User = Depends(require_roles("admin")),
                db: Session = Depends(get_db)):
    api_key = f"gate-{secrets.token_urlsafe(24)}"
    g = Gate(name=body.name, route=body.route, gps_location=body.gps_location,
             api_key_hash=sha256(api_key))
    db.add(g)
    db.flush()
    audit(db, user, "GATE_CREATED", f"gate:{g.gate_id}")
    db.commit()
    db.refresh(g)
    return ok({"gate_id": str(g.gate_id), "name": g.name, "route": g.route,
               "status": g.status, "api_key": api_key,
               "warning": "Store this API key now — it will NOT be shown again"})


# ---------- M5/M6/M7: user management (super_admin) ----------

@router.get("/users")
def list_users(page: int = 1, limit: int = 20, role: str | None = None,
               user: User = Depends(require_roles("super_admin")),
               db: Session = Depends(get_db)):
    q = db.query(User).order_by(User.created_at.desc())
    if role:
        q = q.filter(User.role == role)
    items, pagination = paginate(q, page, limit)
    return ok({"items": [user_summary(u) for u in items], "pagination": pagination})


@router.post("/users")
def create_admin_user(body: AdminUserCreate,
                      user: User = Depends(require_roles("super_admin")),
                      db: Session = Depends(get_db)):
    if db.query(User).filter_by(phone_number=body.phone_number).first():
        raise AppError("DUPLICATE_PHONE", "Phone number already registered", 409)
    if body.email and db.query(User).filter_by(email=body.email).first():
        raise AppError("DUPLICATE_EMAIL", "Email already registered", 409)
    u = User(full_name=body.full_name, phone_number=body.phone_number,
             email=body.email, password_hash=hash_password(body.password),
             role=body.role, verified=True)
    u.account = Account(account_type="individual")
    db.add(u)
    db.flush()
    audit(db, user, "USER_CREATED", f"user:{u.user_id}")
    db.commit()
    db.refresh(u)
    return ok(user_summary(u))


@router.patch("/users/{user_id}/status")
def update_user_status(user_id: str, body: UserStatusUpdate,
                       user: User = Depends(require_roles("super_admin")),
                       db: Session = Depends(get_db)):
    target = db.get(User, _uuid(user_id, "user_id"))
    if not target:
        raise AppError("NOT_FOUND", "User not found", 404)
    if target.user_id == user.user_id:
        raise AppError("CANNOT_SUSPEND_SELF", "You cannot change your own status", 400)
    target.status = body.status
    audit(db, user, "USER_STATUS_CHANGED", f"user:{target.user_id}:{body.status}")
    if body.status == "suspended":
        db.query(RefreshToken).filter_by(user_id=target.user_id)\
            .update({"revoked": True}, synchronize_session=False)
    db.commit()
    return ok(user_summary(target))


# ---------- M8: all transactions (admin + auditor) ----------

@router.get("/transactions")
def admin_transactions(page: int = 1, limit: int = 20,
                       gate_id: str | None = None, status: str | None = None,
                       date_from: str | None = Query(None, alias="from"),
                       date_to: str | None = Query(None, alias="to"),
                       user: User = Depends(require_roles("admin", "auditor")),
                       db: Session = Depends(get_db)):
    q = db.query(Transaction)
    if gate_id:
        q = q.filter(Transaction.gate_id == _uuid(gate_id, "gate_id"))
    if status:
        q = q.filter(Transaction.status == status)
    if date_from:
        q = q.filter(Transaction.captured_at >= parse_dt(date_from, "from"))
    if date_to:
        q = q.filter(Transaction.captured_at <= parse_dt(date_to, "to"))
    q = q.order_by(Transaction.captured_at.desc())
    items, pagination = paginate(q, page, limit)
    return ok({"items": [transaction_payload(db, t) for t in items],
               "pagination": pagination})


# ---------- M9: revenue report (admin + auditor) ----------

@router.get("/reports/revenue")
def revenue_report(group_by: str = "gate",
                   date_from: str | None = Query(None, alias="from"),
                   date_to: str | None = Query(None, alias="to"),
                   user: User = Depends(require_roles("admin", "auditor")),
                   db: Session = Depends(get_db)):
    if group_by not in ("gate", "vehicle_class", "day"):
        raise AppError("VALIDATION_ERROR",
                       "group_by must be gate, vehicle_class or day", 400)
    d_from = parse_dt(date_from, "from") if date_from else utcnow() - timedelta(days=7)
    d_to = parse_dt(date_to, "to") if date_to else utcnow()

    q = (db.query(Transaction)
           .filter(Transaction.status == "paid",
                   Transaction.captured_at >= d_from,
                   Transaction.captured_at <= d_to))

    if group_by == "gate":
        rows = (q.join(Gate, Transaction.gate_id == Gate.gate_id)
                  .with_entities(Gate.name,
                                 func.count(Transaction.transaction_id),
                                 func.sum(Transaction.amount))
                  .group_by(Gate.gate_id)
                  .order_by(func.sum(Transaction.amount).desc()).all())
    elif group_by == "vehicle_class":
        rows = (q.join(Vehicle, Transaction.vehicle_id == Vehicle.vehicle_id)
                  .with_entities(Vehicle.vehicle_class,
                                 func.count(Transaction.transaction_id),
                                 func.sum(Transaction.amount))
                  .group_by(Vehicle.vehicle_class)
                  .order_by(func.sum(Transaction.amount).desc()).all())
    else:  # day
        rows = (q.with_entities(func.date(Transaction.captured_at),
                                func.count(Transaction.transaction_id),
                                func.sum(Transaction.amount))
                  .group_by(func.date(Transaction.captured_at))
                  .order_by(func.date(Transaction.captured_at)).all())

    return ok({"from": d_from.isoformat(), "to": d_to.isoformat(),
               "group_by": group_by,
               "items": [{"group": str(r[0]), "transaction_count": r[1],
                          "total_amount": r[2] or 0} for r in rows]})


# ---------- M10: audit log (admin + auditor) ----------

@router.get("/reports/audit")
def audit_log(page: int = 1, limit: int = 20,
              user: User = Depends(require_roles("admin", "auditor")),
              db: Session = Depends(get_db)):
    q = (db.query(AuditLog, User)
           .outerjoin(User, AuditLog.user_id == User.user_id)
           .order_by(AuditLog.created_at.desc()))
    items, pagination = paginate(q, page, limit)
    return ok({"items": [
        {"log_id": str(log.log_id),
         "user": ({"user_id": str(u.user_id), "full_name": u.full_name,
                   "role": u.role} if u else None),
         "action": log.action, "target": log.target,
         "created_at": log.created_at.isoformat()}
        for log, u in items], "pagination": pagination})


# ---------- M11: violations (admin) ----------

@router.get("/violations")
def list_violations(page: int = 1, limit: int = 20, status: str | None = None,
                    user: User = Depends(require_roles("admin")),
                    db: Session = Depends(get_db)):
    q = (db.query(Violation, Gate)
           .join(Gate, Violation.gate_id == Gate.gate_id))
    if status:
        q = q.filter(Violation.status == status)
    q = q.order_by(Violation.captured_at.desc())
    items, pagination = paginate(q, page, limit)
    return ok({"items": [
        {"violation_id": str(v.violation_id), "plate_number": v.plate_number,
         "gate": {"gate_id": str(v.gate_id), "name": g.name},
         "captured_at": v.captured_at.isoformat(), "image_ref": v.image_ref,
         "status": v.status}
        for v, g in items], "pagination": pagination})