from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from .entity import Entity
from .relation import Relation


class SubGraph(BaseModel):
    entities: List[Entity] = Field(default_factory=list)
    relations: List[Relation] = Field(default_factory=list)
    center_entity_ids: List[str] = Field(default_factory=list)
    depth: int = 1


class EvidenceLevel(str, Enum):
    FULL_TEXT = "full_text"      # 全文证据
    PARAGRAPH = "paragraph"      # 段落证据
    SUMMARY = "summary"          # 总结证据


class Evidence(BaseModel):
    doc_id: int
    doc_name: str
    level: EvidenceLevel
    content: str
    entity_id: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    score: float = 0.0


class ActivationResult(BaseModel):
    query: str
    problem_archetype: str = ""
    matched_entities: List[Entity] = Field(default_factory=list)
    subgraph: SubGraph = Field(default_factory=SubGraph)
    evidences: List[Evidence] = Field(default_factory=list)
    answer: str = ""
    metadata: dict = Field(default_factory=dict)
