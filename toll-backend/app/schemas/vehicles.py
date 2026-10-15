from typing import Literal, Optional

from pydantic import BaseModel, Field


class VehicleCreate(BaseModel):
    plate_number: str = Field(min_length=4, max_length=15)
    rfid_tag_id: Optional[str] = Field(default=None, max_length=32)
    vehicle_class: Literal["motorcycle", "light", "medium", "heavy"]


class VehicleUpdate(BaseModel):
    rfid_tag_id: Optional[str] = Field(default=None, max_length=32)
    vehicle_class: Optional[Literal["motorcycle", "light", "medium", "heavy"]] = None
    status: Optional[Literal["active", "inactive"]] = None