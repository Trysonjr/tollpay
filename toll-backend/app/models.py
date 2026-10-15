import uuid
from datetime import datetime, timezone

from sqlalchemy import (Boolean, DateTime, ForeignKey, Integer, JSON,
                        String, Text, UniqueConstraint, Uuid)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    """Naive UTC everywhere. MySQL DATETIME carries no timezone info, so the
    whole app standardizes on naive-UTC datetimes (never call datetime.now()
    directly — always use this function)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


# ---------- Identity & accounts ----------

class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    full_name: Mapped[str] = mapped_column(String(100))
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="motorist")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    account: Mapped["Account"] = relationship(back_populates="user", uselist=False)


class Account(Base):
    __tablename__ = "accounts"

    account_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id"), unique=True)
    account_type: Mapped[str] = mapped_column(String(20), default="individual")   # individual | fleet
    organization_name: Mapped[str | None] = mapped_column(String(150))
    balance: Mapped[int] = mapped_column(Integer, default=0)                      # ngwee
    low_balance_threshold: Mapped[int] = mapped_column(Integer, default=5000)     # ngwee
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped[User] = relationship(back_populates="account")
    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="account")


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.account_id"), index=True)
    plate_number: Mapped[str] = mapped_column(String(15), unique=True, index=True)  # uppercase, no spaces
    rfid_tag_id: Mapped[str | None] = mapped_column(String(32), unique=True)
    vehicle_class: Mapped[str] = mapped_column(String(20))          # motorcycle | light | medium | heavy
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    account: Mapped[Account] = relationship(back_populates="vehicles")


# ---------- Tolling ----------

class Gate(Base):
    __tablename__ = "gates"

    gate_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100))
    route: Mapped[str] = mapped_column(String(100))
    gps_location: Mapped[str | None] = mapped_column(String(100))
    api_key_hash: Mapped[str] = mapped_column(String(64))           # sha256 of key shown once at creation
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Tariff(Base):
    __tablename__ = "tariffs"
    __table_args__ = (UniqueConstraint("gate_id", "vehicle_class", name="uq_tariff_gate_class"),)

    tariff_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    gate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gates.gate_id"), index=True)
    vehicle_class: Mapped[str] = mapped_column(String(20))
    base_fee: Mapped[int] = mapped_column(Integer)                  # ngwee
    discount_type: Mapped[str] = mapped_column(String(30), default="none")  # none | frequent_user | local_user | exempt


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)  # generated at the gate
    vehicle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vehicles.vehicle_id"), index=True)
    gate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gates.gate_id"), index=True)
    tariff_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tariffs.tariff_id"))
    base_fee: Mapped[int | None] = mapped_column(Integer)
    discount_type: Mapped[str | None] = mapped_column(String(30))
    discount_amount: Mapped[int | None] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(Integer)                    # ngwee
    payment_method: Mapped[str] = mapped_column(String(20))         # account_balance | mobile_money
    status: Mapped[str] = mapped_column(String(20))                 # pending | paid | failed
    source: Mapped[str] = mapped_column(String(20))                 # online | offline_sync
    captured_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    momo_payment: Mapped["MobileMoneyPayment"] = relationship(back_populates="transaction", uselist=False)


class MobileMoneyPayment(Base):
    __tablename__ = "mobile_money_payments"

    payment_ref: Mapped[str] = mapped_column(String(20), primary_key=True)  # PAY-XXXXX
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.transaction_id"))
    provider: Mapped[str] = mapped_column(String(20))               # airtel_money | mtn_momo | zamtel_kwacha
    phone_number: Mapped[str] = mapped_column(String(20))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | declined | timeout
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    transaction: Mapped[Transaction] = relationship(back_populates="momo_payment")


class Topup(Base):
    __tablename__ = "topups"

    topup_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.account_id"), index=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True)  # TOP-XXXXX
    amount: Mapped[int] = mapped_column(Integer)
    provider: Mapped[str] = mapped_column(String(20))
    phone_number: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | completed | failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------- Auth plumbing ----------

class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    phone_number: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    purpose: Mapped[str] = mapped_column(String(20))                # register | reset
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------- Audit, enforcement, notifications ----------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id"))
    action: Mapped[str] = mapped_column(String(50))                 # e.g. TARIFF_UPDATED
    target: Mapped[str | None] = mapped_column(String(100))         # e.g. "tariff:<uuid>"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Violation(Base):
    __tablename__ = "violations"

    violation_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    plate_number: Mapped[str] = mapped_column(String(15), index=True)
    gate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gates.gate_id"))
    captured_at: Mapped[datetime] = mapped_column(DateTime)
    image_ref: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id"), index=True)
    type: Mapped[str] = mapped_column(String(30))                   # receipt | low_balance | topup | alert
    title: Mapped[str] = mapped_column(String(100))
    body: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)   # "read" is a MySQL reserved word
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------- Mock / dev ----------

class MockOutbox(Base):
    __tablename__ = "mock_outbox"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    type: Mapped[str] = mapped_column(String(20))                   # otp | momo_prompt | sms
    recipient: Mapped[str] = mapped_column(String(20))              # "to" is a MySQL reserved word
    payload: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    
class PrepaidPass(Base):
    __tablename__ = "prepaid_passes"

    pass_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.account_id"), index=True)
    gate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gates.gate_id"), index=True)
    vehicle_class: Mapped[str] = mapped_column(String(20))
    amount_paid: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")
    purchased_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime)
    redeemed_transaction_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)