from __future__ import annotations

import logging
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import List

from src.llm.base import BaseLLM
from src.models.entity import Entity, EntitySource
from src.storage.interfaces import GraphStore

logger = logging.getLogger(__name__)


@dataclass
class MergeGroup:
    entities: List[Entity]
    merged_label: str
    merged_summary: str
    reason: str
    confidence: float


@dataclass
class MergePreview:
    entities: List[Entity]
    merged_label: str
    merged_summary: str
    merged_entity_type: str
    all_sources: List[EntitySource]
    relations_to_migrate: List[dict]
    conflicts: List[dict] = field(default_factory=list)


@dataclass
class MergeResult:
    new_entity: Entity
    absorbed_ids: List[str]
    relations_migrated: int
    relations_deleted: int


def _is_similar(a: str, b: str, threshold: float) -> bool:
    """Check if two labels are similar enough to be duplicates."""
    na, nb = a.strip().lower(), b.strip().lower()
    if not na or not nb:
        return False
    # Exact match
    if na == nb:
        return True
    # One contains the other (shorter >= 2 chars)
    if len(na) >= 2 and len(nb) >= 2:
        if na in nb or nb in na:
            return True
    # SequenceMatcher ratio
    ratio = SequenceMatcher(None, na, nb).ratio()
    return ratio >= threshold


def _build_merge_group(cluster: list[Entity]) -> MergeGroup:
    """Build a MergeGroup from a cluster of similar entities."""
    # Pick the longest label as merged_label (usually most descriptive)
    merged_label = max(cluster, key=lambda e: len(e.label)).label
    # Combine unique summaries
    summaries = []
    seen = set()
    for e in cluster:
        s = (e.summary or "").strip()
        if s and s not in seen:
            seen.add(s)
            summaries.append(s)
    merged_summary = summaries[0] if summaries else cluster[0].summary
    # Confidence based on how similar the labels are
    labels = [e.label for e in cluster]
    avg_ratio = sum(
        SequenceMatcher(None, labels[i], labels[j]).ratio()
        for i in range(len(labels))
        for j in range(i + 1, len(labels))
    ) / max(1, len(labels) * (len(labels) - 1) / 2)
    confidence = round(min(0.5 + avg_ratio * 0.5, 1.0), 2)

    return MergeGroup(
        entities=cluster,
        merged_label=merged_label,
        merged_summary=merged_summary,
        reason=f"实体名称相似（{', '.join(labels)}）",
        confidence=confidence,
    )


class MergeAgent:
    def __init__(self, llm: BaseLLM, graph_store: GraphStore, entity_search=None):
        self._llm = llm
        self._graph = graph_store
        self._entity_search = entity_search

    async def scan_candidates(self, similarity_threshold: float = 0.6) -> List[MergeGroup]:
        """Scan all entities for duplicates using string similarity (no LLM)."""
        entities = await self._graph.get_all_entities(limit=5000)
        if len(entities) < 2:
            return []

        # Group entities by type
        by_type: dict[str, list[Entity]] = {}
        for e in entities:
            by_type.setdefault(e.entity_type.value, []).append(e)

        groups: List[MergeGroup] = []

        for etype, type_entities in by_type.items():
            if len(type_entities) < 2:
                continue

            # Find similar pairs within this type using string similarity
            used: set[str] = set()
            for i, a in enumerate(type_entities):
                if a.id in used:
                    continue
                cluster = [a]
                for j in range(i + 1, len(type_entities)):
                    b = type_entities[j]
                    if b.id in used:
                        continue
                    if _is_similar(a.label, b.label, similarity_threshold):
                        cluster.append(b)

                if len(cluster) >= 2:
                    for e in cluster:
                        used.add(e.id)
                    groups.append(_build_merge_group(cluster))

        groups.sort(key=lambda g: g.confidence, reverse=True)
        return groups

    async def preview_merge(
        self,
        entity_ids: List[str],
        merged_label: str,
        merged_summary: str,
    ) -> MergePreview:
        """Preview what would happen if entities are merged."""
        entities = []
        for eid in entity_ids:
            e = await self._graph.get_entity(eid)
            if not e:
                raise ValueError(f"Entity {eid} not found")
            entities.append(e)

        # Verify same type
        types = {e.entity_type.value for e in entities}
        if len(types) > 1:
            raise ValueError("Cannot merge entities of different types")

        entity_type = entities[0].entity_type.value

        # Collect all sources
        all_sources: List[EntitySource] = []
        seen_source_keys = set()
        for e in entities:
            for src in e.sources:
                key = (src.doc_id, src.excerpt[:100])
                if key not in seen_source_keys:
                    seen_source_keys.add(key)
                    all_sources.append(src)

        # Get relations for all entities
        absorbed_set = set(entity_ids)
        relations_to_migrate = []
        conflicts = []

        for eid in entity_ids:
            rels = await self._graph.get_entity_relations(eid)
            for rel in rels:
                other_id = rel["to_id"] if rel["from_id"] == eid else rel["from_id"]
                direction = "outgoing" if rel["from_id"] == eid else "incoming"

                # Intra-group relation → conflict
                if other_id in absorbed_set and other_id != eid:
                    conflicts.append({
                        "type": "intra_group",
                        "rel_type": rel["rel_type"],
                    })
                    continue

                # Self-loop (shouldn't happen but guard)
                if other_id == eid:
                    continue

                relations_to_migrate.append({
                    "from_id": eid if direction == "outgoing" else other_id,
                    "to_id": other_id if direction == "outgoing" else eid,
                    "rel_type": rel["rel_type"],
                    "direction": direction,
                    "weight": rel["weight"],
                    "confidence": rel["confidence"],
                })

        return MergePreview(
            entities=entities,
            merged_label=merged_label,
            merged_summary=merged_summary,
            merged_entity_type=entity_type,
            all_sources=all_sources,
            relations_to_migrate=relations_to_migrate,
            conflicts=conflicts,
        )

    async def execute_merge(
        self,
        entity_ids: List[str],
        merged_label: str,
        merged_summary: str,
    ) -> MergeResult:
        """Create a new merged entity, migrate relations, delete old entities."""
        entities = []
        for eid in entity_ids:
            e = await self._graph.get_entity(eid)
            if not e:
                raise ValueError(f"Entity {eid} not found")
            entities.append(e)

        # Verify same type
        types = {e.entity_type.value for e in entities}
        if len(types) > 1:
            raise ValueError("Cannot merge entities of different types")

        # Merge all sources
        all_sources: List[EntitySource] = []
        seen_source_keys = set()
        for e in entities:
            for src in e.sources:
                key = (src.doc_id, src.excerpt[:100])
                if key not in seen_source_keys:
                    seen_source_keys.add(key)
                    all_sources.append(src)

        # Take highest confidence
        max_confidence = max(e.confidence for e in entities)

        # Create new entity
        new_entity = Entity(
            label=merged_label,
            summary=merged_summary,
            entity_type=entities[0].entity_type,
            subtype=entities[0].subtype,
            sources=all_sources,
            confidence=max_confidence,
        )

        await self._graph.create_entity(new_entity)

        # Update search index: clear old entities, populate new entity
        if self._entity_search:
            for eid in entity_ids:
                self._entity_search.clear_entity(eid)
            self._entity_search.populate_terms(new_entity)

        # Migrate relations and delete old entities
        stats = await self._graph.merge_entity_group(new_entity.id, entity_ids)

        return MergeResult(
            new_entity=new_entity,
            absorbed_ids=entity_ids,
            relations_migrated=stats["relations_migrated"],
            relations_deleted=stats["relations_deleted"],
        )
