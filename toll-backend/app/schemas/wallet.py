from typing import Literal, Optional

from pydantic import BaseModel, Field


class TopupInitiate(BaseModel):
    amount: int = Field(gt=0, description="Amount in ngwee (ZMW 50.00 = 5000)")
    provider: Literal["airtel_money", "mtn_momo", "zamtel_kwacha"]
    phone_number: Optional[str] = None  # E.164; defaults to account phone


class PassPurchase(BaseModel):
    gate_id: str
    vehicle_class: Literal["motorcycle", "light", "medium", "heavy"]