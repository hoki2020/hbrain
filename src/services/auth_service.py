from __future__ import annotations

import sqlite3
import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt

from config.settings import settings


DB_PATH = "./data/auth.db"


def _get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db():
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            avatar TEXT,
            phone TEXT,
            status TEXT DEFAULT 'active',
            roles TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            last_login TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            code TEXT UNIQUE NOT NULL,
            description TEXT,
            permissions TEXT DEFAULT '[]',
            user_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)
    conn.commit()
    conn.close()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None


def _resolve_permissions(roles_json: str) -> list:
    """Resolve role names to a flat list of permission codes.
    Users with no roles get no permissions."""
    import json
    role_names = json.loads(roles_json) if roles_json else []
    if not role_names:
        return []
    conn = _get_conn()
    try:
        placeholders = ",".join("?" for _ in role_names)
        rows = conn.execute(
            f"SELECT permissions FROM roles WHERE name IN ({placeholders}) AND status = 'active'",
            role_names,
        ).fetchall()
        perms = set()
        for r in rows:
            perms.update(json.loads(r["permissions"]))
        return sorted(perms)
    finally:
        conn.close()


def register_user(username: str, email: str, password: str) -> dict:
    if len(password) < 6:
        return {"success": False, "message": "密码长度至少6个字符"}
    if len(password) > 128:
        return {"success": False, "message": "密码长度不能超过128个字符"}

    conn = _get_conn()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            (username, email),
        ).fetchone()
        if existing:
            return {"success": False, "message": "用户名或邮箱已存在"}

        conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, hash_password(password)),
        )
        conn.commit()
        return {"success": True, "message": "注册成功，请登录"}
    finally:
        conn.close()


def login_user(username: str, password: str) -> dict:
    conn = _get_conn()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        if not user or not verify_password(password, user["password_hash"]):
            return {"success": False, "message": "用户名或密码错误"}

        if user["status"] != "active":
            return {"success": False, "message": "账号已被禁用"}

        token = create_token(user["id"], user["username"])
        conn.execute(
            "UPDATE users SET last_login = datetime('now', 'localtime') WHERE id = ?",
            (user["id"],),
        )
        conn.commit()

        import json
        roles_raw = user["roles"]
        return {
            "success": True,
            "message": "登录成功",
            "token": token,
            "user": {
                "id": str(user["id"]),
                "username": user["username"],
                "email": user["email"],
                "avatar": user["avatar"] or f"https://api.dicebear.com/7.x/avataaars/svg?seed={user['username']}",
                "phone": user["phone"] or "",
                "status": user["status"],
                "roles": json.loads(roles_raw),
                "permissions": _resolve_permissions(roles_raw),
                "createdAt": user["created_at"],
                "lastLogin": user["last_login"],
            },
        }
    finally:
        conn.close()


def change_password(user_id: int, old_password: str, new_password: str) -> dict:
    if len(new_password) < 6:
        return {"success": False, "message": "新密码长度至少6个字符"}
    if len(new_password) > 128:
        return {"success": False, "message": "新密码长度不能超过128个字符"}

    conn = _get_conn()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not user:
            return {"success": False, "message": "用户不存在"}

        if not verify_password(old_password, user["password_hash"]):
            return {"success": False, "message": "原密码错误"}

        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(new_password), user_id),
        )
        conn.commit()
        return {"success": True, "message": "密码修改成功"}
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> Optional[dict]:
    conn = _get_conn()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not user:
            return None

        import json
        roles_raw = user["roles"]
        return {
            "id": str(user["id"]),
            "username": user["username"],
            "email": user["email"],
            "avatar": user["avatar"] or f"https://api.dicebear.com/7.x/avataaars/svg?seed={user['username']}",
            "phone": user["phone"] or "",
            "status": user["status"],
            "roles": json.loads(roles_raw),
            "permissions": _resolve_permissions(roles_raw),
            "createdAt": user["created_at"],
            "lastLogin": user["last_login"],
        }
    finally:
        conn.close()


def get_current_user(token: str) -> Optional[dict]:
    payload = decode_token(token)
    if not payload:
        return None
    return get_user_by_id(int(payload["sub"]))


# ── User CRUD ──────────────────────────────────────────────


def list_users() -> list:
    conn = _get_conn()
    try:
        rows = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
        import json
        return [
            {
                "id": str(r["id"]),
                "username": r["username"],
                "email": r["email"],
                "avatar": r["avatar"] or f"https://api.dicebear.com/7.x/avataaars/svg?seed={r['username']}",
                "phone": r["phone"] or "",
                "status": r["status"],
                "roles": json.loads(r["roles"]),
                "createdAt": r["created_at"],
                "lastLogin": r["last_login"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def update_user(user_id: int, **fields) -> dict:
    conn = _get_conn()
    try:
        import json
        allowed = {"username", "email", "phone", "status", "roles", "avatar"}
        updates = []
        values = []
        for k, v in fields.items():
            if k in allowed and v is not None:
                if k == "roles":
                    v = json.dumps(v) if isinstance(v, list) else v
                updates.append(f"{k} = ?")
                values.append(v)
        if not updates:
            return {"success": False, "message": "没有可更新的字段"}
        values.append(user_id)
        conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()
        return {"success": True, "message": "更新成功"}
    finally:
        conn.close()


def delete_user(user_id: int) -> dict:
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        return {"success": True, "message": "删除成功"}
    finally:
        conn.close()


# ── Role CRUD ──────────────────────────────────────────────


def list_roles() -> list:
    conn = _get_conn()
    try:
        rows = conn.execute("SELECT * FROM roles ORDER BY id").fetchall()
        import json
        return [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "code": r["code"],
                "description": r["description"] or "",
                "permissions": json.loads(r["permissions"]),
                "userCount": r["user_count"],
                "status": r["status"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def create_role(name: str, code: str, description: str = "", permissions: list = None) -> dict:
    conn = _get_conn()
    try:
        import json
        existing = conn.execute("SELECT id FROM roles WHERE name = ? OR code = ?", (name, code)).fetchone()
        if existing:
            return {"success": False, "message": "角色名或标识已存在"}
        conn.execute(
            "INSERT INTO roles (name, code, description, permissions) VALUES (?, ?, ?, ?)",
            (name, code, description, json.dumps(permissions or [])),
        )
        conn.commit()
        return {"success": True, "message": "创建成功"}
    finally:
        conn.close()


def update_role(role_id: int, **fields) -> dict:
    conn = _get_conn()
    try:
        import json
        allowed = {"name", "code", "description", "permissions", "user_count", "status"}
        updates = []
        values = []
        for k, v in fields.items():
            if k in allowed and v is not None:
                if k == "permissions":
                    v = json.dumps(v) if isinstance(v, list) else v
                updates.append(f"{k} = ?")
                values.append(v)
        if not updates:
            return {"success": False, "message": "没有可更新的字段"}
        values.append(role_id)
        conn.execute(f"UPDATE roles SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()
        return {"success": True, "message": "更新成功"}
    finally:
        conn.close()


def delete_role(role_id: int) -> dict:
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM roles WHERE id = ?", (role_id,))
        conn.commit()
        return {"success": True, "message": "删除成功"}
    finally:
        conn.close()


# ── Permissions (static) ───────────────────────────────────


def list_permissions() -> list:
    return [
        {
            "module": "dashboard",
            "moduleName": "仪表盘",
            "permissions": [
                {"id": "1", "name": "查看仪表盘", "code": "dashboard:view", "module": "dashboard", "type": "menu"},
            ],
        },
        {
            "module": "knowledge",
            "moduleName": "知识库管理",
            "permissions": [
                {"id": "2", "name": "查看知识库", "code": "knowledge:view", "module": "knowledge", "type": "menu"},
                {"id": "3", "name": "上传文档", "code": "knowledge:upload", "module": "knowledge", "type": "button"},
                {"id": "4", "name": "删除文档", "code": "knowledge:delete", "module": "knowledge", "type": "button"},
            ],
        },
        {
            "module": "graph",
            "moduleName": "知识图谱",
            "permissions": [
                {"id": "5", "name": "查看图谱", "code": "graph:view", "module": "graph", "type": "menu"},
            ],
        },
        {
            "module": "user",
            "moduleName": "用户管理",
            "permissions": [
                {"id": "6", "name": "查看用户", "code": "user:view", "module": "user", "type": "menu"},
                {"id": "7", "name": "创建用户", "code": "user:create", "module": "user", "type": "button"},
                {"id": "8", "name": "编辑用户", "code": "user:edit", "module": "user", "type": "button"},
                {"id": "9", "name": "删除用户", "code": "user:delete", "module": "user", "type": "button"},
            ],
        },
        {
            "module": "role",
            "moduleName": "角色管理",
            "permissions": [
                {"id": "10", "name": "查看角色", "code": "role:view", "module": "role", "type": "menu"},
                {"id": "11", "name": "创建角色", "code": "role:create", "module": "role", "type": "button"},
                {"id": "12", "name": "编辑角色", "code": "role:edit", "module": "role", "type": "button"},
                {"id": "13", "name": "删除角色", "code": "role:delete", "module": "role", "type": "button"},
                {"id": "14", "name": "分配权限", "code": "role:assign", "module": "role", "type": "button"},
            ],
        },
        {
            "module": "permission",
            "moduleName": "权限管理",
            "permissions": [
                {"id": "15", "name": "查看权限", "code": "permission:view", "module": "permission", "type": "menu"},
            ],
        },
        {
            "module": "settings",
            "moduleName": "系统设置",
            "permissions": [
                {"id": "16", "name": "系统设置", "code": "settings:view", "module": "settings", "type": "menu"},
                {"id": "17", "name": "保存设置", "code": "settings:save", "module": "settings", "type": "button"},
            ],
        },
    ]


# Initialize DB on import
init_auth_db()
