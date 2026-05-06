from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel

from src.api.deps import get_current_user, get_entity_search, get_graph_store, get_merge_agent
from src.services import graph_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/data")
async def get_graph_data(user: dict = Depends(get_current_user)):
    store = get_graph_store()
    return await graph_service.get_full_graph(store)


@router.get("/search")
async def search_graph(q: str = "", user: dict = Depends(get_current_user)):
    store = get_graph_store()
    if not q:
        return await graph_service.get_full_graph(store)
    return await graph_service.search_graph(store, q, entity_search=get_entity_search())


@router.get("/stats")
async def get_graph_stats(user: dict = Depends(get_current_user)):
    store = get_graph_store()
    data = await graph_service.get_full_graph(store)
    type_counts = {}
    for n in data["nodes"]:
        t = n["type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    return {
        "totalNodes": len(data["nodes"]),
        "totalEdges": len(data["edges"]),
        "nodeTypes": type_counts,
    }


@router.delete("/all")
async def clear_graph(user: dict = Depends(get_current_user)):
    perms = user.get("permissions", [])
    if "*" not in perms and "role:assign" not in perms:
        raise HTTPException(status_code=403, detail="无权限清空图谱，需要 admin 权限")

    logger.warning(f"[图谱] 用户 {user['username']}(id={user['id']}) 清空了全部知识图谱")
    store = get_graph_store()
    await store.delete_all()
    return {"success": True, "message": "Graph cleared"}


# ── Merge Endpoints ──────────────────────────────────────


from typing import List


class MergePreviewRequest(BaseModel):
    entity_ids: List[str]
    merged_label: str
    merged_summary: str


class MergeExecuteRequest(BaseModel):
    entity_ids: List[str]
    merged_label: str
    merged_summary: str


def _entity_dict(e) -> dict:
    return {
        "id": e.id,
        "label": e.label,
        "summary": e.summary,
        "entity_type": e.entity_type.value,
        "subtype": e.subtype,
        "confidence": e.confidence,
        "sources": [s.model_dump(mode="json") for s in e.sources],
    }


@router.post("/merge/scan")
async def merge_scan(user: dict = Depends(get_current_user)):
    """Scan all entities for semantic duplicates using LLM."""
    agent = get_merge_agent()
    groups = await agent.scan_candidates()
    return {
        "candidates": [
            {
                "entities": [_entity_dict(e) for e in g.entities],
                "merged_label": g.merged_label,
                "merged_summary": g.merged_summary,
                "reason": g.reason,
                "confidence": g.confidence,
            }
            for g in groups
        ]
    }


@router.post("/merge/preview")
async def merge_preview(
    body: MergePreviewRequest,
    user: dict = Depends(get_current_user),
):
    """Preview merge result: entities, relations to migrate, conflicts."""
    agent = get_merge_agent()
    try:
        preview = await agent.preview_merge(
            body.entity_ids, body.merged_label, body.merged_summary
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "entities": [_entity_dict(e) for e in preview.entities],
        "merged_label": preview.merged_label,
        "merged_summary": preview.merged_summary,
        "entity_type": preview.merged_entity_type,
        "all_sources": [s.model_dump(mode="json") for s in preview.all_sources],
        "relations_to_migrate": preview.relations_to_migrate,
        "conflicts": preview.conflicts,
    }


@router.post("/merge/execute")
async def merge_execute(
    body: MergeExecuteRequest,
    user: dict = Depends(get_current_user),
):
    """Execute entity merge: create new entity, migrate relations, delete old entities."""
    agent = get_merge_agent()
    try:
        result = await agent.execute_merge(
            body.entity_ids, body.merged_label, body.merged_summary
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "new_entity": _entity_dict(result.new_entity),
        "absorbed_ids": result.absorbed_ids,
        "relations_migrated": result.relations_migrated,
        "relations_deleted": result.relations_deleted,
    }