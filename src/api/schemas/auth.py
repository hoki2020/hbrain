from __future__ import annotations

from pydantic import BaseModel
from typing import Optional, List, Any


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    oldPassword: str
    newPassword: str


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None


class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None
