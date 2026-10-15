from typing import Any

from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict = {}


def ok(data: Any = None) -> dict:
    """Every success response goes through this — keeps the envelope uniform."""
    return {"success": True, "data": data, "error": None}