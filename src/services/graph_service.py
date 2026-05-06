from __future__ import annotations

import logging
from typing import Dict, List

from src.models.entity import Entity
from src.models.relation import Relation, RelationType
from src.storage.interfaces import GraphStore

logger = logging.getLogger(__name__)

RELATION_LABELS = {
    RelationType.MENTIONS: "提及",
    RelationType.DEFINES: "定义",
    RelationType.DESCRIBES: "描述",
    RelationType.PART_OF: "属于",
    RelationType.CONTAINS: "包含",
    RelationType.BELONGS_TO: "归属于",
    RelationType.RESPONSIBLE_FOR: "负责",
    RelationType.PERFORMS: "执行",
    RelationType.USES: "使用",
    RelationType.CREATES: "创建",
    RelationType.REQUIRES: "需要",
    RelationType.PROHIBITS: "禁止",
    RelationType.PERMITS: "允许",
    RelationType.DEPENDS_ON: "依赖于",
    RelationType.CAUSES: "导致",
    RelationType.AFFECTS: "影响",
    RelationType.MITIGATES: "缓解",
    RelationType.MEASURES: "度量",
    RelationType.ATTRIBUTE: "属性",
    RelationType.EVIDENCE_FOR: "证据支持",
    RelationType.CONTRADICTS: "矛盾",
    RelationType.DERIVED_FROM: "源自",
}


def entity_to_graph_node(entity: Entity) -> dict:
    label = entity.label
    return {
        "id": entity.id,
        "label": label,
        "summary": entity.summary[:2000],
        "type": entity.entity_type.value,
        "subtype": entity.subtype or "",
        "sources": [
            {
                "doc_id": s.doc_id,
                "doc_name": s.doc_name or "",
                "excerpt": s.excerpt[:1000],
                "addedAt": s.added_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
            for s in entity.sources
        ],
        "confidence": round(entity.confidence * 100),
    }


def relation_to_graph_edge(relation: Relation) -> dict:
    label = RELATION_LABELS.get(relation.relation_type, "关联")
    return {
        "id": f"{relation.source_id}-{relation.target_id}",
        "source": relation.source_id,
        "target": relation.target_id,
        "relationship": relation.relation_type.value,
        "relationshipLabel": label,
        "weight": relation.weight,
        "confidence": round(relation.confidence * 100),
    }


async def get_full_graph(graph_store: GraphStore) -> dict:
    entities = await graph_store.get_all_entities(limit=500)
    relations = await graph_store.get_all_relations(limit=1000)

    return {
        "nodes": [entity_to_graph_node(e) for e in entities],
        "edges": [relation_to_graph_edge(r) for r in relations],
    }


async def search_graph(graph_store: GraphStore, query: str, entity_search=None) -> dict:
    if not entity_search:
        raise ValueError("entity_search is required for graph search")
    logger.info(f"[图谱搜索] 查询: '{query}'")
    entities = await entity_search.search_entities(query, graph_store, limit=50)
    entity_ids = {e.id for e in entities}
    logger.info(f"[图谱搜索] FTS5 匹配 {len(entities)} 个实体")

    # Get relations between matched entities
    all_relations = await graph_store.get_all_relations(limit=1000)
    matched_relations = [
        r for r in all_relations
        if r.source_id in entity_ids or r.target_id in entity_ids
    ]

    # Also include directly connected entities
    connected_ids = set(entity_ids)
    for r in matched_relations:
        connected_ids.add(r.source_id)
        connected_ids.add(r.target_id)

    # Fetch any missing connected entities
    all_entities = {e.id: e for e in entities}
    for eid in connected_ids:
        if eid not in all_entities:
            e = await graph_store.get_entity(eid)
            if e:
                all_entities[eid] = e

    logger.info(
        f"[图谱搜索] 完成: {len(all_entities)} 个节点, {len(matched_relations)} 条边"
    )
    return {
        "nodes": [entity_to_graph_node(e) for e in all_entities.values()],
        "edges": [relation_to_graph_edge(r) for r in matched_relations],
    }
