from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from src.api.routes import auth, entities, graph, health, knowledge, operations, search, users, roles, permissions
from src.api.deps import get_graph_store

logger = logging.getLogger(__name__)

_DEFAULT_JWT_SECRET = "hbrain-secret-key-change-in-production"
_DEFAULT_MINIO_ACCESS = "minioadmin"
_DEFAULT_MINIO_SECRET = "minioadmin"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup security checks
    if settings.JWT_SECRET == _DEFAULT_JWT_SECRET:
        logger.warning(
            "[安全] JWT_SECRET 使用了默认值，请在 .env 中设置一个随机密钥！"
            " 当前任何人都可以伪造 JWT token。"
        )
    if settings.MINIO_ACCESS_KEY == _DEFAULT_MINIO_ACCESS and settings.MINIO_SECRET_KEY == _DEFAULT_MINIO_SECRET:
        logger.warning(
            "[安全] MINIO_ACCESS_KEY/SECRET 使用了默认值 minioadmin，请修改！"
            " MinIO 默认凭据已被广泛知晓，务必在生产环境中修改。"
        )

    # Backfill search index for existing entities
    await _backfill_search_index()

    yield

    # Shutdown
    store = get_graph_store()
    store.close()


async def _backfill_search_index():
    """Populate FTS5 search index for any entities missing from it."""
    import sqlite3
    from src.api.deps import get_entity_search

    entity_search = get_entity_search()
    store = get_graph_store()

    # Get all entity IDs already in the search index
    conn = sqlite3.connect(entity_search._db_path)
    try:
        rows = conn.execute(
            "SELECT DISTINCT canonical_entity_id FROM entity_search_terms"
        ).fetchall()
        indexed_ids = {r[0] for r in rows}
    finally:
        conn.close()

    # Get all entities from Kuzu
    all_entities = await store.get_all_entities(limit=10000)
    missing = [e for e in all_entities if e.id not in indexed_ids]

    if not missing:
        logger.info(f"[启动] 搜索索引检查: {len(all_entities)} 个实体已全部索引")
        return

    logger.info(f"[启动] 搜索索引回填: {len(all_entities)} 个实体, {len(missing)} 个待索引")
    count = 0
    for entity in missing:
        try:
            entity_search.populate_terms(entity)
            count += 1
        except Exception as e:
            logger.warning(f"[启动] 实体 '{entity.label}'({entity.id}) 索引失败: {e}")
    logger.info(f"[启动] 搜索索引回填完成: {count}/{len(missing)} 个实体已索引")


app = FastAPI(
    title="HBrain - Human Brain Semantic Network",
    description="Knowledge graph system simulating human brain semantic memory",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://localhost:{settings.API_PORT}",
        f"http://127.0.0.1:{settings.API_PORT}",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(entities.router, prefix="/api")
app.include_router(graph.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(roles.router, prefix="/api")
app.include_router(permissions.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": "HBrain",
        "description": "Human Brain Semantic Network",
        "docs": "/docs",
    }
