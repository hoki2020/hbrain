from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from src.services import auth_service

router = APIRouter(prefix="/roles", tags=["roles"])


def _extract_user_id(authorization: Optional[str]) -> Optional[int]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = auth_service.decode_token(token)
    return int(payload["sub"]) if payload else None


class CreateRoleRequest(BaseModel):
    name: str
    code: str
    description: str = ""
    permissions: list = []


class UpdateRoleRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list] = None
    status: Optional[str] = None


@router.get("")
async def list_roles(authorization: Optional[str] = Header(None)):
    if not _extract_user_id(authorization):
        return {"success": False, "message": "未登录"}
    roles = auth_service.list_roles()
    return {"success": True, "roles": roles}


@router.post("")
async def create_role(req: CreateRoleRequest, authorization: Optional[str] = Header(None)):
    if not _extract_user_id(authorization):
        return {"success": False, "message": "未登录"}
    result = auth_service.create_role(req.name, req.code, req.description, req.permissions)
    return result


@router.put("/{role_id}")
async def update_role(role_id: int, req: UpdateRoleRequest, authorization: Optional[str] = Header(None)):
    if not _extract_user_id(authorization):
        return {"success": False, "message": "未登录"}
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    result = auth_service.update_role(role_id, **fields)
    return result


@router.delete("/{role_id}")
async def delete_role(role_id: int, authorization: Optional[str] = Header(None)):
    if not _extract_user_id(authorization):
        return {"success": False, "message": "未登录"}
    result = auth_service.delete_role(role_id)
    return result
