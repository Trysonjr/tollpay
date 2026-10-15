import re
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str
    email: Optional[EmailStr] = None
    password: str = Field(min_length=8)
    account_type: Literal["individual", "fleet"] = "individual"
    organization_name: Optional[str] = None

    @model_validator(mode="after")
    def validate(self):
        if not PHONE_RE.match(self.phone_number):
            raise ValueError("phone_number must be E.164 format, e.g. +260971234567")
        if self.account_type == "fleet" and not self.organization_name:
            raise ValueError("organization_name is required for fleet accounts")
        return self


class VerifyOtpRequest(BaseModel):
    phone_number: str
    code: str = Field(min_length=4, max_length=8)


class LoginRequest(BaseModel):
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    password: str

    @model_validator(mode="after")
    def validate(self):
        if not self.phone_number and not self.email:
            raise ValueError("phone_number or email is required")
        return self


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    phone_number: str


class ResetPasswordRequest(BaseModel):
    phone_number: str
    code: str
    new_password: str = Field(min_length=8)