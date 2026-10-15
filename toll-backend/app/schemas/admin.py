import re
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


class TariffCreate(BaseModel):
    gate_id: str
    vehicle_class: Literal["motorcycle", "light", "medium", "heavy"]
    base_fee: int = Field(ge=0, description="Ngwee (ZMW 25.00 = 2500)")
    discount_type: Literal["none", "frequent_user", "local_user", "exempt"] = "none"


class TariffUpdate(BaseModel):
    base_fee: Optional[int] = Field(default=None, ge=0)
    discount_type: Optional[Literal["none", "frequent_user", "local_user", "exempt"]] = None


class GateCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    route: str = Field(min_length=2, max_length=100)
    gps_location: Optional[str] = None


class AdminUserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str
    email: Optional[EmailStr] = None
    password: str = Field(min_length=8)
    role: Literal["admin", "auditor", "super_admin"]

    @model_validator(mode="after")
    def validate(self):
        if not PHONE_RE.match(self.phone_number):
            raise ValueError("phone_number must be E.164 format, e.g. +260971234567")
        return self


class UserStatusUpdate(BaseModel):
    status: Literal["active", "suspended"]