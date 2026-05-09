from __future__ import annotations

import logging
from difflib import SequenceMatcher
from typing import List

from src.models.entity import Entity, EntitySource
from src.models.relation import Relation

logger = logging.getLogger(__name__)

# Company/institution suffixes to strip for matching
_COMPANY_SUFFIXES = (
    "有限责任公司", "股份有限公司", "有限公司", "集团公司", "集团",
    "股份公司", "有限公司", "公司", "企业", "工厂", "研究院",
    "研究所", "大学", "学院", "医院", "中心", "协会", "基金会",
)


def _normalize_label(s: str) -> str:
    """Normalize label for comparison."""
    s = s.strip().lower()
    # Remove common company suffixes for matching
    for suffix in _COMPANY_SUFFIXES:
        if s.endswith(suffix) and len(s) > len(suffix):
            s = s[: -len(suffix)]
            break
    return s


def _is_match(a_norm: str, b_norm: str, a_raw: str, b_raw: str) -> bool:
    """Check if two normalized labels indicate the same entity."""
    if not a_norm or not b_norm:
        return False
    # Exact match after normalization
    if a_norm == b_norm:
        return True
    # Containment (shorter >= 2 chars)
    if len(a_norm) >= 2 and len(b_norm) >= 2:
        if a_norm in b_norm or b_norm in a_norm:
            return True
    # SequenceMatcher for fuzzy match
    ratio = SequenceMatcher(None, a_norm, b_norm).ratio()
    return ratio >= 0.85


def _pick_canonical_label(entities: List[Entity]) -> str:
    """Pick the longest, most descriptive label."""
    return max(entities, key=lambda e: len(e.label)).label


def _pick_best_summary(entities: List[Entity]) -> str:
    """Pick the most informative summary (longest non-JSON, or longest JSON for rule/image)."""
    # For rule/image types, pick longest JSON summary
    first_type = entities[0].entity_type.value
    if first_type in ("rule", "image"):
        return max(entities, key=lambda e: len(e.summary or "")).summary

    # For other types, pick longest summary
    return max(entities, key=lambda e: len(e.summary or "")).summary


def _merge_sources(entities: List[Entity]) -> List[EntitySource]:
    """Merge sources from all entities, deduplicating by (doc_id, excerpt prefix)."""
    seen: set[tuple[int | None, str]] = set()
    merged: List[EntitySource] = []
    for e in entities:
        for src in e.sources:
            key = (src.doc_id, src.excerpt[:200])
            if key not in seen:
                seen.add(key)
                merged.append(src)
    return merged


class CanonicalizationAgent:
    """Cross-chunk entity canonicalization and deduplication.

    Pure Python — no LLM calls.
    """

    def canonicalize(
        self,
        chunk_results: list[tuple[list[Entity], list[Relation]]],
    ) -> tuple[list[Entity], list[Relation]]:
        """Merge entities and deduplicate relations across chunks.

        Args:
            chunk_results: list of (entities, relations) from each chunk.

        Returns:
            (merged_entities, deduplicated_relations)
        """
        # Collect all entities and relations
        all_entities: list[Entity] = []
        all_relations: list[Relation] = []
        for entities, relations in chunk_results:
            all_entities.extend(entities)
            all_relations.extend(relations)

        if not all_entities:
            return [], []

        logger.info(
            f"[规范化] 输入: {len(all_entities)} 个实体, {len(all_relations)} 条关系 "
            f"(来自 {len(chunk_results)} 个 chunk)"
        )

        # Group entities by type, then find duplicates within each type
        by_type: dict[str, list[Entity]] = {}
        for e in all_entities:
            by_type.setdefault(e.entity_type.value, []).append(e)

        # Build mapping: old entity id → canonical entity
        id_map: dict[str, str] = {}  # old_id → canonical_id
        canonical_entities: list[Entity] = []

        for etype, type_entities in by_type.items():
            clusters = self._find_clusters(type_entities)
            for cluster in clusters:
                merged = self._merge_cluster(cluster)
                for e in cluster:
                    id_map[e.id] = merged.id
                canonical_entities.append(merged)

        # Deduplicate relations using id_map
        seen_rels: set[tuple[str, str, str]] = set()
        deduped_relations: list[Relation] = []

        for rel in all_relations:
            src_id = id_map.get(rel.source_id, rel.source_id)
            tgt_id = id_map.get(rel.target_id, rel.target_id)

            # Skip self-loops
            if src_id == tgt_id:
                continue

            key = (src_id, tgt_id, rel.relation_type.value)
            if key not in seen_rels:
                seen_rels.add(key)
                deduped_relations.append(Relation(
                    source_id=src_id,
                    target_id=tgt_id,
                    relation_type=rel.relation_type,
                    weight=rel.weight,
                    confidence=rel.confidence,
                ))

        logger.info(
            f"[规范化] 输出: {len(canonical_entities)} 个实体, "
            f"{len(deduped_relations)} 条关系 "
            f"(去重: {len(all_entities) - len(canonical_entities)} 实体, "
            f"{len(all_relations) - len(deduped_relations)} 关系)"
        )

        return canonical_entities, deduped_relations

    def _find_clusters(self, entities: List[Entity]) -> list[list[Entity]]:
        """Find groups of entities that refer to the same thing."""
        used: set[str] = set()
        clusters: list[list[Entity]] = []

        for i, a in enumerate(entities):
            if a.id in used:
                continue
            cluster = [a]
            used.add(a.id)
            a_norm = _normalize_label(a.label)

            for j in range(i + 1, len(entities)):
                b = entities[j]
                if b.id in used:
                    continue
                b_norm = _normalize_label(b.label)
                if _is_match(a_norm, b_norm, a.label, b.label):
                    cluster.append(b)
                    used.add(b.id)

            clusters.append(cluster)
        return clusters

    def _merge_cluster(self, cluster: list[Entity]) -> Entity:
        """Merge a cluster of duplicate entities into one."""
        if len(cluster) == 1:
            return cluster[0]

        return Entity(
            label=_pick_canonical_label(cluster),
            summary=_pick_best_summary(cluster),
            entity_type=cluster[0].entity_type,
            subtype=cluster[0].subtype,
            sources=_merge_sources(cluster),
            confidence=max(e.confidence for e in cluster),
        )
