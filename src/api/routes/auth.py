from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header

from src.services import auth_service
from src.api.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    ChangePasswordRequest,
    UpdateProfileRequest,
    AuthResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _extract_user_id(authorization: Optional[str]) -> Optional[int]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = auth_service.decode_token(token)
    return int(payload["sub"]) if payload else None


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    result = auth_service.login_user(req.username, req.password)
    return result


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    result = auth_service.register_user(req.username, req.email, req.password)
    return result


@router.post("/change-password", response_model=AuthResponse)
async def change_password(
    req: ChangePasswordRequest,
    authorization: Optional[str] = Header(None),
):
    user_id = _extract_user_id(authorization)
    if not user_id:
        return {"success": False, "message": "未登录"}
    result = auth_service.change_password(user_id, req.oldPassword, req.newPassword)
    return result


@router.get("/me")
async def get_me(authorization: Optional[str] = Header(None)):
    user_id = _extract_user_id(authorization)
    if not user_id:
        return {"success": False, "message": "未登录"}
    user = auth_service.get_user_by_id(user_id)
    if not user:
        return {"success": False, "message": "用户不存在"}
    return {"success": True, "user": user}


@router.put("/profile")
async def update_profile(
    req: UpdateProfileRequest,
    authorization: Optional[str] = Header(None),
):
    user_id = _extract_user_id(authorization)
    if not user_id:
        return {"success": False, "message": "未登录"}
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    if not fields:
        return {"success": False, "message": "没有可更新的字段"}
    result = auth_service.update_user(user_id, **fields)
    if result["success"]:
        user = auth_service.get_user_by_id(user_id)
        return {"success": True, "message": "更新成功", "user": user}
    return result
