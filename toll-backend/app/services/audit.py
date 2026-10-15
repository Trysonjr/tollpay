from sqlalchemy.orm import Session

from app.models import AuditLog, User


def audit(db: Session, user: User, action: str, target: str | None = None):
    """Record an administrative action. Called by every admin write endpoint —
    this is what M10 reports on."""
    db.add(AuditLog(user_id=user.user_id, action=action, target=target))