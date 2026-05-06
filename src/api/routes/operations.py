from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_current_user, get_knowledge_service
from src.api.schemas.requests import IngestRequest
from src.api.schemas.responses import EntityResponse, IngestResponse, RelationResponse

router = APIRouter(tags=["operations"])


@router.post("/ingest", response_model=IngestResponse)
async def ingest_text(req: IngestRequest, user: dict = Depends(get_current_user)):
    svc = get_knowledge_service()
    result = await svc.ingest(text=req.text)
    return IngestResponse(
        entities=[
            EntityResponse(
                id=e.id,
                label=e.label,
                summary=e.summary,
                entity_type=e.entity_type.value,
                confidence=e.confidence,
            )
            for e in result.entities
        ],
        relations=[
            RelationResponse(
                source_id=r.source_id,
                target_id=r.target_id,
                relation_type=r.relation_type.value,
                weight=r.weight,
                confidence=r.confidence,
            )
            for r in result.relations
        ],
        errors=result.evaluation_issues,
    )
