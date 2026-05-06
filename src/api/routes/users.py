from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from src.services import auth_service

router = APIRouter(prefix="/users", tags=["users"])


def _extract_user_id(authorization: Optional[str]) -> Optional[int]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = auth_service.decode_token(token)
    return int(payload["sub"]) if payload else None


def _check_permission(authorization: Optional[str], required: str) -> Optional[dict]:
    """Returns user dict if authorized, None otherwise."""
    user_id = _extract_user_id(authorization)
    if not user_id:
        return None
    user = auth_service.get_user_by_id(user_id)
    if not user:
        return None
    perms = user.get("permissions", [])
    # Wildcard grants all permissions
    if "*" in perms or required in perms:
        return user
    return None


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    phone: Optional[str] = None
    roles: Optional[list] = None


class UpdateUserRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    roles: Optional[list] = None
    avatar: Optional[str] = None


@router.get("")
async def list_users(authorization: Optional[str] = Header(None)):
    if not _extract_user_id(authorization):
        return {"success": False, "message": "未登录"}
    users = auth_service.list_users()
    return {"success": True, "users": users}


@router.post("")
async def create_user(req: CreateUserRequest, authorization: Optional[str] = Header(None)):
    caller = _check_permission(authorization, "user:create")
    if not caller:
        return {"success": False, "message": "未登录或无权限"}
    result = auth_service.register_user(req.username, req.email, req.password)
    if result["success"] and req.phone:
        user = auth_service.list_users()
        new_user = next((u for u in user if u["username"] == req.username), None)
        if new_user:
            auth_service.update_user(int(new_user["id"]), phone=req.phone, roles=req.roles or [])
    return result


@router.put("/{user_id}")
async def update_user(user_id: int, req: UpdateUserRequest, authorization: Optional[str] = Header(None)):
    if not _extract_user_id(authorization):
        return {"success": False, "message": "未登录"}
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    result = auth_service.update_user(user_id, **fields)
    return result


@router.delete("/{user_id}")
async def delete_user(user_id: int, authorization: Optional[str] = Header(None)):
    if not _extract_user_id(authorization):
        return {"success": False, "message": "未登录"}
    result = auth_service.delete_user(user_id)
    return result
