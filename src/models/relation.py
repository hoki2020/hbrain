from __future__ import annotations

from enum import Enum
from typing import Any, Dict

from pydantic import BaseModel, Field


class RelationType(str, Enum):
    MENTIONS = "mentions"
    DEFINES = "defines"
    DESCRIBES = "describes"
    PART_OF = "part_of"
    CONTAINS = "contains"
    BELONGS_TO = "belongs_to"
    RESPONSIBLE_FOR = "responsible_for"
    PERFORMS = "performs"
    USES = "uses"
    CREATES = "creates"
    REQUIRES = "requires"
    PROHIBITS = "prohibits"
    PERMITS = "permits"
    DEPENDS_ON = "depends_on"
    CAUSES = "causes"
    AFFECTS = "affects"
    MITIGATES = "mitigates"
    MEASURES = "measures"
    ATTRIBUTE = "attribute"
    EVIDENCE_FOR = "evidence_for"
    CONTRADICTS = "contradicts"
    DERIVED_FROM = "derived_from"


class Relation(BaseModel):
    source_id: str
    target_id: str
    relation_type: RelationType
    weight: float = Field(default=1.0, ge=0.0, le=10.0)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ── 关系权重（用于多跳打分） ──
EDGE_WEIGHTS: dict[RelationType, float] = {
    RelationType.DEFINES:         1.00,
    RelationType.CAUSES:          0.95,
    RelationType.DEPENDS_ON:      0.92,
    RelationType.REQUIRES:        0.90,
    RelationType.MITIGATES:       0.90,
    RelationType.CONTRADICTS:     0.90,
    RelationType.AFFECTS:         0.85,
    RelationType.PROHIBITS:       0.85,
    RelationType.PERMITS:         0.82,
    RelationType.RESPONSIBLE_FOR: 0.80,
    RelationType.PERFORMS:        0.78,
    RelationType.USES:            0.75,
    RelationType.CREATES:         0.75,
    RelationType.CONTAINS:        0.72,
    RelationType.BELONGS_TO:      0.72,
    RelationType.PART_OF:         0.72,
    RelationType.MEASURES:        0.65,
    RelationType.ATTRIBUTE:       0.58,
    RelationType.EVIDENCE_FOR:    0.55,
    RelationType.DESCRIBES:       0.45,
    RelationType.MENTIONS:        0.35,
    RelationType.DERIVED_FROM:    0.30,
}

DEFAULT_EDGE_WEIGHT = 0.50

# 弱关系：可召回但不继续扩展
NON_EXPANDABLE_RELATIONS: set[RelationType] = {
    RelationType.MENTIONS,
    RelationType.DESCRIBES,
    RelationType.EVIDENCE_FOR,
    RelationType.DERIVED_FROM,
    RelationType.ATTRIBUTE,
}
