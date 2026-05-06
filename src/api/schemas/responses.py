from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class EntityResponse(BaseModel):
    id: str
    label: str
    summary: str
    entity_type: str
    confidence: float


class RelationResponse(BaseModel):
    source_id: str
    target_id: str
    relation_type: str
    weight: float
    confidence: float


class IngestResponse(BaseModel):
    entities: List[EntityResponse]
    relations: List[RelationResponse]
    errors: List[str]


class EvidenceResponse(BaseModel):
    doc_id: int
    doc_name: str
    level: str
    content: str
    entity_id: Optional[str] = None


class QueryResponse(BaseModel):
    success: bool
    query: str
    problem_archetype: str
    answer: str
    matched_count: int
    total_entities: int
    evidences: List[EvidenceResponse]
    entities: List[EntityResponse]


class HealthResponse(BaseModel):
    status: str
    version: str
