import re
import secrets

from sqlalchemy.orm import Session

from app.models import (Account, Gate, MobileMoneyPayment, Notification,
                        Transaction, Vehicle)

PROVIDER_PREFIXES = {
    "97": "airtel_money", "77": "airtel_money",
    "96": "mtn_momo", "76": "mtn_momo",
    "95": "zamtel_kwacha", "75": "zamtel_kwacha",
}


def provider_from_phone(phone: str) -> str:
    """Guess the motorist's mobile-money provider from the Zambian number prefix."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 11:
        return PROVIDER_PREFIXES.get(digits[-9:-7], "airtel_money")
    return "airtel_money"


def new_payment_ref() -> str:
    return f"PAY-{secrets.token_hex(3).upper()}"


def resolve_payment(db: Session, payment: MobileMoneyPayment, outcome: str) -> None:
    """outcome: 'approved' | 'declined' | 'timeout'. Idempotent — ignores if not pending."""
    if payment.status != "pending":
        return
    payment.status = outcome
    tx: Transaction = payment.transaction
    if outcome == "approved":
        tx.status = "paid"
        vehicle = db.get(Vehicle, tx.vehicle_id)
        gate = db.get(Gate, tx.gate_id)
        account = db.get(Account, vehicle.account_id)
        provider = payment.provider.replace("_", " ").title()
        db.add(Notification(
            user_id=account.user_id, type="receipt",
            title="Toll paid via mobile money",
            body=(f"ZMW {payment.amount / 100:.2f} paid at {gate.name} for "
                  f"{vehicle.plate_number} via {provider}. "
                  f"Receipt ID: {str(tx.transaction_id)[:8].upper()}."),
        ))
    else:
        tx.status = "failed"