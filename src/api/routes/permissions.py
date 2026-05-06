from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header

from src.services import auth_service

router = APIRouter(prefix="/permissions", tags=["permissions"])


def _extract_user_id(authorization: Optional[str]) -> Optional[int]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = auth_service.decode_token(token)
    return int(payload["sub"]) if payload else None


@router.get("")
async def list_permissions(authorization: Optional[str] = Header(None)):
    if not _extract_user_id(authorization):
        return {"success": False, "message": "未登录"}
    modules = auth_service.list_permissions()
    return {"success": True, "modules": modules}
