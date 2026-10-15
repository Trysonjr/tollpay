import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError
from app.models import Notification, User
from app.schemas.common import ok
from app.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def parse_uuid(value: str, what: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        raise AppError("VALIDATION_ERROR", f"Invalid {what} format", 400)


def notification_payload(n: Notification) -> dict:
    return {
        "notification_id": str(n.notification_id),
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "read": n.is_read,
        "created_at": n.created_at.isoformat(),
    }


# N1
@router.get("")
def list_notifications(user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    items = (db.query(Notification)
               .filter(Notification.user_id == user.user_id)
               .order_by(Notification.created_at.desc())
               .limit(50).all())
    return ok([notification_payload(n) for n in items])


# N2
@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    nid = parse_uuid(notification_id, "notification_id")
    n = db.get(Notification, nid)
    if not n or n.user_id != user.user_id:
        raise AppError("NOT_FOUND", "Notification not found", 404)
    n.is_read = True
    db.commit()
    return ok({"marked": True})