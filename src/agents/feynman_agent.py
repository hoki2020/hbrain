from __future__ import annotations

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

from src.llm.base import BaseLLM
from src.models.entity import Entity, EntitySource, EntityType
from src.models.relation import Relation, RelationType
from src.storage.interfaces import GraphStore
from prompts.feynman_extraction import FEYNMAN_EXTRACTION_SYSTEM, FEYNMAN_EXTRACTION_USER


class FeynmanAgent:
    # Legacy type normalization (handle LLM outputting old type names)
    _LEGACY_ENTITY_MAP = {
        "problem": "issue",
        "method": "activity",
        "principle": "rule",
        "case": "event",
        "boundary": "rule",
    }
    _LEGACY_RELATION_MAP = {
        "SOLVES": "responsible_for",
        "EXPLAINS": "describes",
        "EVIDENCED_BY": "evidence_for",
        "FAILS_WHEN": "contradicts",
        "ABSTRACTS_TO": "derived_from",
        "INSTANTIATES": "contains",
        "SUPPORTS": "evidence_for",
        "HAS_PART": "contains",
        "BELONGS": "belongs_to",
        "RELATED_TO": "describes",
        "IMPLEMENTS": "performs",
        "INCLUDES": "contains",
    }

    def __init__(self, llm: BaseLLM, graph_store: GraphStore):
        self._llm = llm
        self._graph = graph_store

    def _normalize_entity_type(self, raw: str) -> str:
        return self._LEGACY_ENTITY_MAP.get(raw, raw)

    def _normalize_relation_type(self, raw: str) -> str:
        return self._LEGACY_RELATION_MAP.get(raw, raw)

    async def extract(
        self,
        text: str,
        doc_id: Optional[int] = None,
        doc_name: Optional[str] = None,
    ) -> tuple[List[Entity], List[Relation]]:
        """Extract entities and relations from document text."""
        doc_label = doc_name or f"文档#{doc_id}"
        logger.info(f"[抽取] 开始从 '{doc_label}' 抽取实体和关系 (文本长度={len(text)})")

        result = await self._llm.complete_json(
            FEYNMAN_EXTRACTION_SYSTEM,
            FEYNMAN_EXTRACTION_USER.format(text=text),
        )

        raw_entities = result.get("entities", [])
        raw_relations = result.get("relations", [])
        logger.info(f"[抽取] LLM 返回: {len(raw_entities)} 个实体, {len(raw_relations)} 个关系")

        entities: List[Entity] = []
        entity_map: dict[str, Entity] = {}  # label → Entity
        skipped_entities = 0

        for item in raw_entities:
            raw_type = self._normalize_entity_type(item["type"])
            # summary: normalize to string (LLM may return dict, list, or other types)
            summary = item.get("summary", "")
            if not isinstance(summary, str):
                import json
                summary = json.dumps(summary, ensure_ascii=False) if summary else ""
            label = item.get("label", "")
            if not isinstance(label, str):
                label = str(label) if label else ""
            subtype = item.get("subtype") or None
            if subtype and not isinstance(subtype, str):
                subtype = str(subtype)

            if not label.strip():
                skipped_entities += 1
                continue

            entity = Entity(
                label=label,
                summary=summary,
                entity_type=EntityType(raw_type),
                subtype=subtype,
                sources=[EntitySource(
                    doc_id=doc_id,
                    doc_name=doc_name,
                    excerpt=text[:500],
                )],
            )
            entities.append(entity)
            entity_map[entity.label] = entity

        relations: List[Relation] = []
        skipped_relations = 0
        for rel in raw_relations:
            src_label = rel.get("source_label", "")
            tgt_label = rel.get("target_label", "")
            if not isinstance(src_label, str):
                src_label = str(src_label) if src_label else ""
            if not isinstance(tgt_label, str):
                tgt_label = str(tgt_label) if tgt_label else ""
            if src_label in entity_map and tgt_label in entity_map:
                raw_rel = self._normalize_relation_type(rel.get("type", ""))
                try:
                    rel_type = RelationType(raw_rel)
                except ValueError:
                    logger.warning(f"[抽取] 未知关系类型 '{raw_rel}'，跳过")
                    skipped_relations += 1
                    continue
                relations.append(Relation(
                    source_id=entity_map[src_label].id,
                    target_id=entity_map[tgt_label].id,
                    relation_type=rel_type,
                ))
            else:
                skipped_relations += 1

        # Log entity type distribution
        type_counts: dict[str, int] = {}
        for e in entities:
            t = e.entity_type.value
            type_counts[t] = type_counts.get(t, 0) + 1
        type_str = ", ".join(f"{t}×{c}" for t, c in sorted(type_counts.items(), key=lambda x: -x[1]))

        logger.info(
            f"[抽取] 完成 '{doc_label}': "
            f"{len(entities)} 个实体 ({type_str}), "
            f"{len(relations)} 个关系"
        )
        if skipped_entities:
            logger.info(f"[抽取] 跳过 {skipped_entities} 个空标签实体")
        if skipped_relations:
            logger.info(f"[抽取] 跳过 {skipped_relations} 个无效关系 (端点不存在或类型未知)")

        return entities, relations
