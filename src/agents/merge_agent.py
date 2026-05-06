from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import List

from src.llm.base import BaseLLM
from src.models.entity import Entity, EntitySource
from src.storage.interfaces import GraphStore
from prompts.merge_detection import MERGE_SCAN_SYSTEM, MERGE_SCAN_USER

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


class MergeAgent:
    def __init__(self, llm: BaseLLM, graph_store: GraphStore, entity_search=None):
        self._llm = llm
        self._graph = graph_store
        self._entity_search = entity_search

    async def scan_candidates(self) -> List[MergeGroup]:
        """Scan all entities grouped by type, LLM identifies duplicate groups."""
        entities = await self._graph.get_all_entities(limit=500)
        if len(entities) < 2:
            return []

        # Build compact entity list for LLM
        entity_list = []
        for e in entities:
            entity_list.append({
                "id": e.id,
                "label": e.label,
                "type": e.entity_type.value,
                "summary": e.summary[:300] if e.summary else "",
            })

        entities_json = json.dumps(entity_list, ensure_ascii=False, indent=2)
        user_prompt = MERGE_SCAN_USER.format(entities_json=entities_json)

        try:
            result = await self._llm.complete_json(
                system_prompt=MERGE_SCAN_SYSTEM,
                user_prompt=user_prompt,
                temperature=0.1,
            )
        except Exception as exc:
            logger.error("Merge scan LLM call failed: %s", exc)
            return []

        raw_candidates = result.get("candidates", [])
        if not raw_candidates:
            return []

        # Build entity lookup
        entity_map = {e.id: e for e in entities}

        groups = []
        for c in raw_candidates:
            entity_ids = c.get("entity_ids", [])
            if len(entity_ids) < 2:
                continue

            # Validate all entities exist and are the same type
            group_entities = []
            for eid in entity_ids:
                if eid in entity_map:
                    group_entities.append(entity_map[eid])

            if len(group_entities) < 2:
                continue

            # Verify same entity type
            types = {e.entity_type.value for e in group_entities}
            if len(types) > 1:
                logger.warning("Skipping merge group with mixed types: %s", types)
                continue

            groups.append(MergeGroup(
                entities=group_entities,
                merged_label=c.get("merged_label", group_entities[0].label),
                merged_summary=c.get("merged_summary", group_entities[0].summary),
                reason=c.get("reason", ""),
                confidence=float(c.get("confidence", 0.5)),
            ))

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
