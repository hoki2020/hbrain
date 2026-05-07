from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from config.settings import settings
from src.api.deps import get_current_user, get_knowledge_service
from src.api.schemas.requests import QueryRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"])


@router.post("")
async def search_knowledge(req: QueryRequest, user: dict = Depends(get_current_user)):
    logger.info(f"[搜索] 收到查询: '{req.question}' (max_depth={req.max_depth})")
    svc = get_knowledge_service()

    try:
        result = await svc.query(
            req.question,
            max_depth=req.max_depth,
        )
    except Exception as e:
        logger.error(f"[搜索] 查询失败: {type(e).__name__}: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "知识检索服务暂时不可用，请检查 LLM 服务配置后重试。",
                "detail": str(e),
            },
        )

    logger.info(
        f"[搜索] 查询完成: '{req.question}' → "
        f"匹配{len(result.matched_entities)}个实体, "
        f"{len(result.evidences)}条证据, "
        f"答案{len(result.answer)}字"
    )

    return {
        "success": True,
        "query": result.query,
        "problem_archetype": result.problem_archetype,
        "answer": result.answer,
        "matched_count": len(result.matched_entities),
        "total_entities": len(result.subgraph.entities) if result.subgraph else 0,
        "evidences": [
            {
                "doc_id": ev.doc_id,
                "doc_name": ev.doc_name,
                "level": ev.level.value,
                "content": ev.content[:2000],
                "entity_id": ev.entity_id,
                "doc_url": f"{settings.API_BASE_URL}/api/knowledge/documents/{ev.doc_id}/download" if ev.doc_id and ev.doc_id > 0 else None,
                "images": [
                    f"{settings.API_BASE_URL}/api/knowledge/proxy-image/{key}"
                    if not key.startswith("http") else key
                    for key in (ev.images or [])
                ],
            }
            for ev in result.evidences
        ],
        "entities": [
            {
                "id": e.id,
                "label": e.label,
                "type": e.entity_type.value,
                "subtype": e.subtype or "",
                "summary": e.summary[:2000],
            }
            for e in result.matched_entities
        ],
    }


@router.get("/graph/{entity_id}")
async def graph_search(entity_id: str, depth: int = 2, user: dict = Depends(get_current_user)):
    from src.api.deps import get_graph_store, get_search_service
    store = get_graph_store()

    entity = await store.get_entity(entity_id)
    if not entity:
        return {"error": "Entity not found"}

    from src.models.relation import RelationType
    related = {}
    for rel_type in RelationType:
        targets = await store.get_related(entity_id, rel_type, direction="outgoing")
        if targets:
            related[rel_type.value] = [
                {"id": t.id, "label": t.label, "type": t.entity_type.value}
                for t in targets
            ]

    return {
        "entity": {
            "id": entity.id,
            "label": entity.label,
            "summary": entity.summary,
            "type": entity.entity_type.value,
            "subtype": entity.subtype or "",
        },
        "related": related,
    }
