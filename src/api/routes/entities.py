from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_current_user, get_graph_store
from src.api.schemas.responses import EntityResponse, RelationResponse
from src.models.relation import RelationType

router = APIRouter(prefix="/entities", tags=["entities"])


def _entity_to_response(entity) -> EntityResponse:
    return EntityResponse(
        id=entity.id,
        label=entity.label,
        summary=entity.summary[:300],
        entity_type=entity.entity_type.value,
        confidence=entity.confidence,
    )


@router.get("", response_model=List[EntityResponse])
async def list_entities(
    entity_type: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    store = get_graph_store()
    if entity_type:
        entities = await store.find_by_type(entity_type, limit=limit)
    else:
        entities = await store.get_all_entities(limit=limit)
    return [_entity_to_response(e) for e in entities[:limit]]


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(entity_id: str, user: dict = Depends(get_current_user)):
    store = get_graph_store()
    entity = await store.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return _entity_to_response(entity)


@router.get("/{entity_id}/related")
async def get_related_entities(
    entity_id: str,
    relation_type: Optional[str] = None,
    direction: str = "outgoing",
    user: dict = Depends(get_current_user),
):
    store = get_graph_store()
    entity = await store.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if relation_type:
        try:
            rel_type = RelationType(relation_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid relation type: {relation_type}")
        related = await store.get_related(entity_id, rel_type, direction=direction)
        return [_entity_to_response(e) for e in related]

    # Return all related entities grouped by relation type
    result = {}
    for rel_type in RelationType:
        targets = await store.get_related(entity_id, rel_type, direction="outgoing")
        if targets:
            result[rel_type.value] = [_entity_to_response(e) for e in targets]
    return result


@router.delete("/{entity_id}")
async def delete_entity(entity_id: str, user: dict = Depends(get_current_user)):
    store = get_graph_store()
    entity = await store.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    await store.delete_entity(entity_id)
    return {"status": "deleted", "id": entity_id}
