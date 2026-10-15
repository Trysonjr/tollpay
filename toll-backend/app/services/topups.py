from sqlalchemy.orm import Session

from app.models import Account, Notification, Topup


def resolve_topup(db: Session, topup: Topup, outcome: str) -> None:
    """outcome: 'approved' | 'declined' | 'timeout'.
    Only acts while pending — safe to call twice (idempotent)."""
    if topup.status != "pending":
        return

    if outcome == "approved":
        account = db.get(Account, topup.account_id)
        account.balance += topup.amount
        topup.status = "completed"
        provider_name = topup.provider.replace("_", " ").title()
        db.add(Notification(
            user_id=account.user_id,
            type="topup",
            title="Top-up successful",
            body=(f"ZMW {topup.amount / 100:.2f} was added to your toll account "
                  f"via {provider_name}. New balance: ZMW {account.balance / 100:.2f}."),
        ))
    else:
        topup.status = "failed"