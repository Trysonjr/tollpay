import re
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError
from app.models import User, Vehicle
from app.schemas.common import ok
from app.schemas.vehicles import VehicleCreate, VehicleUpdate
from app.security import get_current_user

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

PLATE_RE = re.compile(r"^[A-Z0-9]{4,10}$")


def normalize_plate(p: str) -> str:
    return p.upper().replace(" ", "").replace("-", "")


def vehicle_payload(v: Vehicle) -> dict:
    return {
        "vehicle_id": str(v.vehicle_id),
        "plate_number": v.plate_number,
        "rfid_tag_id": v.rfid_tag_id,
        "vehicle_class": v.vehicle_class,
        "status": v.status,
        "created_at": v.created_at.isoformat(),
    }


def get_owned_vehicle(db: Session, user: User, vehicle_id: str) -> Vehicle:
    try:
        vid = uuid.UUID(vehicle_id)
    except ValueError:
        raise AppError("VALIDATION_ERROR", "Invalid vehicle id", 400)
    v = db.get(Vehicle, vid)
    if not v or v.account_id != user.account.account_id:
        raise AppError("NOT_FOUND", "Vehicle not found", 404)
    return v


# V1
@router.get("")
def list_vehicles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vehicles = (db.query(Vehicle)
                  .filter(Vehicle.account_id == user.account.account_id)
                  .order_by(Vehicle.created_at.desc()).all())
    return ok([vehicle_payload(v) for v in vehicles])


# V2
@router.post("")
def create_vehicle(body: VehicleCreate, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    plate = normalize_plate(body.plate_number)
    if not PLATE_RE.match(plate):
        raise AppError("PLATE_INVALID",
                       "Plate must be 4-10 letters/digits, e.g. ABC1234", 400)
    if db.query(Vehicle).filter_by(plate_number=plate).first():
        raise AppError("DUPLICATE_PLATE", "That plate number is already registered", 409)
    if body.rfid_tag_id and db.query(Vehicle).filter_by(rfid_tag_id=body.rfid_tag_id).first():
        raise AppError("DUPLICATE_TAG", "That RFID tag is already registered to a vehicle", 409)

    v = Vehicle(account_id=user.account.account_id, plate_number=plate,
                rfid_tag_id=body.rfid_tag_id, vehicle_class=body.vehicle_class)
    db.add(v)
    db.commit()
    db.refresh(v)
    return ok(vehicle_payload(v))


# V3
@router.patch("/{vehicle_id}")
def update_vehicle(vehicle_id: str, body: VehicleUpdate,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    v = get_owned_vehicle(db, user, vehicle_id)

    if body.rfid_tag_id is not None:
        if body.rfid_tag_id == "":
            v.rfid_tag_id = None
        else:
            clash = (db.query(Vehicle)
                       .filter(Vehicle.rfid_tag_id == body.rfid_tag_id,
                               Vehicle.vehicle_id != v.vehicle_id).first())
            if clash:
                raise AppError("DUPLICATE_TAG", "That RFID tag is already registered", 409)
            v.rfid_tag_id = body.rfid_tag_id
    if body.vehicle_class is not None:
        v.vehicle_class = body.vehicle_class
    if body.status is not None:
        v.status = body.status

    db.commit()
    db.refresh(v)
    return ok(vehicle_payload(v))


# V4
@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: str, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    v = get_owned_vehicle(db, user, vehicle_id)
    v.status = "inactive"  # soft delete
    db.commit()
    return ok({"deleted": True, "vehicle_id": str(v.vehicle_id)})