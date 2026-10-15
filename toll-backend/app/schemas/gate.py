from typing import Optional

from pydantic import BaseModel, Field


class GateTransaction(BaseModel):
    transaction_id: str
    plate_number: Optional[str] = None
    rfid_tag_id: Optional[str] = None
    captured_at: Optional[str] = None


class SyncItem(BaseModel):
    transaction_id: str
    plate_number: Optional[str] = None
    rfid_tag_id: Optional[str] = None
    captured_at: Optional[str] = None
    amount: int = Field(ge=0)


class SyncRequest(BaseModel):
    transactions: list[SyncItem]


class ViolationReport(BaseModel):
    plate_number: str
    captured_at: Optional[str] = None
    image_ref: Optional[str] = None