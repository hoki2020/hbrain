from __future__ import annotations

import logging
from typing import List, Optional

from prompts.retrieval import (
    ANSWER_SYSTEM,
    ANSWER_USER,
    EVIDENCE_FILTER_SYSTEM,
    EVIDENCE_FILTER_USER,
    RETRIEVAL_SYSTEM,
    RETRIEVAL_USER,
)
from src.llm.base import BaseLLM
from src.models.entity import Entity
from src.models.graph import ActivationResult, Evidence, EvidenceLevel, SubGraph
from src.models.relation import RelationType
from src.storage.interfaces import GraphStore

logger = logging.getLogger(__name__)


class RetrievalAgent:
    def __init__(self, llm: BaseLLM, graph_store: GraphStore, entity_search=None):
        self._llm = llm
        self._graph = graph_store
        self._entity_search = entity_search

    async def retrieve(
        self,
        question: str,
        max_depth: int = 2,
    ) -> ActivationResult:
        logger.info(f"[检索] ── 开始检索: '{question}'")

        # Step 1: Analyze query → problem archetype + keywords
        analysis = await self._llm.complete_json(
            RETRIEVAL_SYSTEM,
            RETRIEVAL_USER.format(question=question),
        )
        problem_archetype = str(analysis.get("problem_archetype", ""))
        raw_keywords = analysis.get("keywords", [])
        # Flatten nested lists (LLM may return [["kw1", "kw2"]] instead of ["kw1", "kw2"])
        keywords = []
        if isinstance(raw_keywords, list):
            for item in raw_keywords:
                if isinstance(item, list):
                    keywords.extend(str(s) for s in item)
                elif isinstance(item, str):
                    keywords.append(item)
                else:
                    keywords.append(str(item))
        else:
            keywords = [str(raw_keywords)]

        logger.info(f"[检索] Step1 分析完成: 类型='{problem_archetype}', 关键词={keywords}")

        # Step 2: Graph match — search all terms in parallel
        import asyncio

        search_terms = [problem_archetype] + keywords
        search_tasks = [
            self._entity_search.search_entities(term, self._graph, limit=5)
            for term in search_terms
        ]
        results = await asyncio.gather(*search_tasks, return_exceptions=True)

        matched_entities: List[Entity] = []
        seen_ids = set()
        for term, result in zip(search_terms, results):
            if isinstance(result, Exception):
                logger.warning(f"[检索] Step2 搜索 '{term}' 失败: {result}")
                continue
            logger.info(f"[检索] Step2 搜索 '{term}' → 命中 {len(result)} 个: {[e.label for e in result]}")
            for e in result:
                if e.id not in seen_ids:
                    seen_ids.add(e.id)
                    matched_entities.append(e)

        logger.info(f"[检索] Step2 完成: 共匹配 {len(matched_entities)} 个去重实体")

        if not matched_entities:
            logger.info(f"[检索] 未找到匹配实体，提前返回")
            return ActivationResult(
                query=question,
                problem_archetype=problem_archetype,
                matched_entities=[],
                subgraph=SubGraph(),
                evidences=[],
                answer="未找到与问题相关的知识实体，请尝试换个问法或先导入相关文档。",
            )

        # Step 3: Weighted BFS graph expansion
        from collections import defaultdict
        from src.models.relation import EDGE_WEIGHTS, DEFAULT_EDGE_WEIGHT, NON_EXPANDABLE_RELATIONS

        HOP_DECAY = 0.7
        MAX_DEPTH = 3
        MAX_ENTITIES = 20

        all_relations = await self._graph.get_all_relations(limit=5000)

        # Build adjacency: entity_id → [(neighbor_id, rel_type, weight)]
        adj: dict[str, list[tuple[str, RelationType, float]]] = defaultdict(list)
        for r in all_relations:
            w = EDGE_WEIGHTS.get(r.relation_type, DEFAULT_EDGE_WEIGHT)
            adj[r.source_id].append((r.target_id, r.relation_type, w))
            adj[r.target_id].append((r.source_id, r.relation_type, w))

        # BFS with scores
        entity_scores: dict[str, float] = {}
        entity_depths: dict[str, int] = {}
        queue: list[tuple[str, float, int]] = []  # (entity_id, score, depth)
        seen_edges: set[tuple[str, str, str]] = set()  # (src, tgt, rel_type) for dedup
        hit_edges: list[tuple[str, str, str, float]] = []  # (src, tgt, rel_type, weight)

        for e in matched_entities:
            entity_scores[e.id] = 1.0
            entity_depths[e.id] = 0
            queue.append((e.id, 1.0, 0))

        visited = set(e.id for e in matched_entities)

        while queue:
            current_id, current_score, depth = queue.pop(0)
            if depth >= MAX_DEPTH:
                continue
            for neighbor_id, rel_type, edge_weight in adj.get(current_id, []):
                new_score = current_score * edge_weight * HOP_DECAY
                # Deduplicate edge (bidirectional adjacency creates both directions)
                edge_key = (min(current_id, neighbor_id), max(current_id, neighbor_id), rel_type.value)
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    hit_edges.append((current_id, neighbor_id, rel_type.value, edge_weight))
                if neighbor_id not in entity_scores or new_score > entity_scores[neighbor_id]:
                    entity_scores[neighbor_id] = new_score
                    entity_depths[neighbor_id] = depth + 1
                # Weak relations: include in results but don't continue expanding
                if neighbor_id not in visited and rel_type not in NON_EXPANDABLE_RELATIONS:
                    visited.add(neighbor_id)
                    queue.append((neighbor_id, new_score, depth + 1))

        # Sort by score, take top 20 (excluding matched entities themselves for logging)
        sorted_ids = sorted(entity_scores, key=lambda k: entity_scores[k], reverse=True)[:MAX_ENTITIES]
        subgraph_entities = await self._graph.get_entities_by_ids(sorted_ids)

        expansion_count = len(subgraph_entities) - len(matched_entities)
        logger.info(
            f"[检索] Step3 加权BFS: {len(matched_entities)} 匹配 → {len(all_relations)} 关系 → "
            f"{len(subgraph_entities)} 实体 (TOP {MAX_ENTITIES}), {len(hit_edges)} 命中边"
        )
        # Log top scored entities
        for eid in sorted_ids[:5]:
            logger.info(f"[检索]   → {eid[:8]}... score={entity_scores[eid]:.4f} depth={entity_depths.get(eid, '?')}")

        # Step 4: Evidence gathering (full_text > paragraph > summary)
        evidences = await self._gather_evidences(subgraph_entities, keywords)
        level_counts = {}
        for ev in evidences:
            level_counts[ev.level.value] = level_counts.get(ev.level.value, 0) + 1
        level_str = ", ".join(f"{k}×{v}" for k, v in level_counts.items())
        logger.info(f"[检索] Step4 证据收集: {len(evidences)} 条 ({level_str})")

        # Step 5: Filter evidences by relevance (LLM evaluation)
        evidence_count_before = len(evidences)
        if evidences:
            evidences = await self._filter_evidences(question, evidences, keywords)
        logger.info(f"[检索] Step5 证据评估: {evidence_count_before} → {len(evidences)} 条")

        # Step 6: Compress evidences if too large
        graph_context = self._serialize_context(subgraph_entities)
        evidences_text = self._serialize_evidences(evidences)

        logger.info(f"[检索] Step6 序列化: graph={len(graph_context)} chars, evidences={len(evidences_text)} chars")
        if len(evidences_text) > 8000:
            logger.info(f"[检索] Step6 证据压缩: {len(evidences_text)} → 目标 8000 chars...")
            evidences_text = await self._compress_evidences(
                question, evidences_text, max_chars=8000
            )
            logger.info(f"[检索] Step6 压缩完成: {len(evidences_text)} chars")

        # Step 7: Generate answer
        answer = await self._llm.complete(
            ANSWER_SYSTEM,
            ANSWER_USER.format(
                question=question,
                graph_context=graph_context,
                evidences=evidences_text,
            ),
            temperature=0.4,
            max_tokens=3000,
        )
        logger.info(f"[检索] Step7 生成回答: {len(answer)} chars")

        # Build subgraph with relations from BFS hit edges
        from src.models.relation import Relation

        entity_id_set = set(sorted_ids)
        subgraph_relations = [
            Relation(
                source_id=src,
                target_id=tgt,
                relation_type=RelationType(rt),
                weight=w,
            )
            for src, tgt, rt, w in hit_edges
            if src in entity_id_set and tgt in entity_id_set
        ]

        logger.info(
            f"[检索] ── 检索完成: {len(matched_entities)} 匹配, "
            f"{len(subgraph_entities)} 实体, {len(subgraph_relations)} 关系, "
            f"{len(evidences)} 证据, 答案 {len(answer)} chars"
        )

        return ActivationResult(
            query=question,
            problem_archetype=problem_archetype,
            matched_entities=matched_entities,
            subgraph=SubGraph(
                entities=subgraph_entities,
                relations=subgraph_relations,
                center_entity_ids=[e.id for e in matched_entities],
                depth=max_depth,
            ),
            evidences=evidences,
            answer=answer,
            metadata={
                "evidence_filter": {
                    "before": evidence_count_before,
                    "after": len(evidences),
                    "removed": evidence_count_before - len(evidences),
                },
            },
        )

    async def _gather_evidences(
        self,
        entities: List[Entity],
        keywords: List[str],
    ) -> List[Evidence]:
        """Gather evidence per entity with priority: full_text > paragraph > summary.

        Rules:
        - doc < 5000 chars  → full text evidence (全文证据)
        - doc >= 5000 chars → search paragraphs using entity.label + keywords (段落证据, max 10)
        - doc >= 5000 chars AND no matching paragraphs → entity summary (总结证据)

        Priority is per-document: if doc X already has full_text/paragraph evidence
        from any entity, skip summary evidence from other entities referencing doc X.
        """
        import re

        from src.services.document_service import get_document, search_paragraphs

        evidences: List[Evidence] = []
        seen_evidence_keys: set[tuple[int, str]] = set()  # (doc_id, content_prefix) for dedup
        docs_with_evidence: set[int] = set()  # doc_ids that already have full_text/paragraph evidence
        doc_cache: dict[int, Optional[dict]] = {}  # cache loaded documents
        keyword_str = ",".join(keywords[:5])

        def _add_evidence(ev: Evidence) -> bool:
            """Add evidence if not a duplicate. Returns True if added."""
            key = (ev.doc_id, ev.content[:200])
            if key in seen_evidence_keys:
                return False
            seen_evidence_keys.add(key)
            evidences.append(ev)
            return True

        def _get_doc_cached(doc_id: int) -> Optional[dict]:
            if doc_id not in doc_cache:
                doc_cache[doc_id] = get_document(doc_id)
            return doc_cache[doc_id]

        # Separate IMAGE entities for caption matching
        image_entities = [e for e in entities if e.entity_type.value == "image"]
        normal_entities = [e for e in entities if e.entity_type.value != "image"]

        for entity in normal_entities:
            entity_has_doc_evidence = False

            for source in entity.sources:
                doc_id = source.doc_id
                if doc_id is None:
                    continue

                doc = _get_doc_cached(doc_id)
                if not doc:
                    logger.debug(f"[证据] 文档 #{doc_id} 不存在，跳过")
                    continue

                content = doc.get("markdownContent") or doc.get("content") or ""
                if not content:
                    logger.debug(f"[证据] 文档 #{doc_id} 内容为空，跳过")
                    continue
                doc_name = source.doc_name or f"文档#{doc_id}"

                if len(content) < 5000:
                    # ── 全文证据 ──
                    img_urls = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", content)
                    ev = Evidence(
                        doc_id=doc_id,
                        doc_name=doc_name,
                        level=EvidenceLevel.FULL_TEXT,
                        content=content,
                        entity_id=entity.id,
                        images=img_urls,
                    )
                    if _add_evidence(ev):
                        entity_has_doc_evidence = True
                        docs_with_evidence.add(doc_id)
                        logger.info(f"[证据] 实体'{entity.label}' → 文档'{doc_name}' 全文证据 ({len(content)} chars)")
                else:
                    # ── 段落证据 ──
                    search_kw = ",".join([entity.label, keyword_str])
                    paragraphs = search_paragraphs(doc_id, search_kw)
                    if paragraphs:
                        para_count = 0
                        for para in paragraphs[:10]:
                            if len(para.strip()) < 20:
                                continue
                            img_urls = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", para)
                            ev = Evidence(
                                doc_id=doc_id,
                                doc_name=doc_name,
                                level=EvidenceLevel.PARAGRAPH,
                                content=para[:500],
                                entity_id=entity.id,
                                images=img_urls,
                            )
                            if _add_evidence(ev):
                                para_count += 1
                        if para_count:
                            entity_has_doc_evidence = True
                            docs_with_evidence.add(doc_id)
                            logger.info(f"[证据] 实体'{entity.label}' → 文档'{doc_name}' 段落证据 ×{para_count}")
                    else:
                        logger.debug(f"[证据] 实体'{entity.label}' → 文档'{doc_name}' 无段落匹配")

            # ── 总结证据（兜底） ──
            # 只有当实体没有任何文档，或者实体关联的所有文档都没有更高优先级证据时，才使用总结
            if not entity_has_doc_evidence and entity.summary:
                entity_doc_ids = {s.doc_id for s in entity.sources if s.doc_id is not None}
                if not entity_doc_ids or entity_doc_ids.isdisjoint(docs_with_evidence):
                    ev = Evidence(
                        doc_id=0,
                        doc_name=f"实体: {entity.label}",
                        level=EvidenceLevel.SUMMARY,
                        content=entity.summary,
                        entity_id=entity.id,
                    )
                    if _add_evidence(ev):
                        logger.info(f"[证据] 实体'{entity.label}' → 无文档证据，使用总结证据")
                else:
                    logger.debug(f"[证据] 实体'{entity.label}' → 关联文档已有更高优先级证据，跳过总结")

        # ── 图片证据 ──
        for img_entity in image_entities:
            try:
                import json

                summary_data = json.loads(img_entity.summary)
                caption = summary_data.get("caption", "")
                image_url = summary_data.get("image_url", "")
                caption_lower = caption.lower()
                if any(kw.lower() in caption_lower for kw in keywords):
                    ev = Evidence(
                        doc_id=int(summary_data.get("doc_id", 0)),
                        doc_name=f"图片: {img_entity.label}",
                        level=EvidenceLevel.PARAGRAPH,
                        content=f"图片描述: {caption}",
                        entity_id=img_entity.id,
                        images=[image_url] if image_url else [],
                    )
                    if _add_evidence(ev):
                        logger.info(f"[证据] 图片实体'{img_entity.label}' 关键词匹配，添加图片证据")
            except (json.JSONDecodeError, ValueError):
                pass

        return evidences

    async def _filter_evidences(
        self,
        question: str,
        evidences: List[Evidence],
        keywords: List[str],
    ) -> List[Evidence]:
        """Filter evidences by relevance to the question using LLM.

        Returns only evidences deemed relevant. Does not modify evidence content.
        Falls back to returning all evidences on failure or empty result.
        """
        import logging

        logger = logging.getLogger(__name__)

        if not evidences:
            return evidences

        # Serialize evidences with index
        level_labels = {
            EvidenceLevel.FULL_TEXT: "全文证据",
            EvidenceLevel.PARAGRAPH: "段落证据",
            EvidenceLevel.SUMMARY: "总结证据",
        }
        lines = []
        for i, ev in enumerate(evidences):
            level_tag = level_labels.get(ev.level, "证据")
            lines.append(f"[{i}] [{level_tag}] 来源: {ev.doc_name}\n    内容: {ev.content[:300]}")
        evidences_text = "\n\n".join(lines)

        try:
            result = await self._llm.complete_json(
                EVIDENCE_FILTER_SYSTEM,
                EVIDENCE_FILTER_USER.format(
                    question=question,
                    keywords=", ".join(keywords[:5]),
                    evidences_text=evidences_text,
                ),
                temperature=0.1,
            )

            relevant_indices = result.get("relevant_indices", [])
            if not isinstance(relevant_indices, list):
                relevant_indices = []

            # Fallback: if LLM returns empty list, keep all evidences
            if not relevant_indices:
                logger.info("证据评估返回空列表，保留全部证据")
                return evidences

            # Validate indices
            valid_indices = set()
            for idx in relevant_indices:
                if isinstance(idx, int) and 0 <= idx < len(evidences):
                    valid_indices.add(idx)

            if not valid_indices:
                logger.info("证据评估返回的索引均无效，保留全部证据")
                return evidences

            filtered = [evidences[i] for i in sorted(valid_indices)]
            logger.info(
                f"证据评估: {len(evidences)} → {len(filtered)} 条相关证据"
            )
            return filtered

        except Exception as e:
            logger.error(f"证据评估失败，保留全部证据: {e}")
            return evidences

    async def _compress_evidences(
        self, question: str, evidences_text: str, max_chars: int = 8000
    ) -> str:
        """Compress evidences using LLM when context exceeds model limits."""
        if len(evidences_text) <= max_chars:
            return evidences_text
        return await self._llm.complete(
            "你是一个信息压缩助手。将以下证据列表压缩到保留核心信息，去除重复和无关内容。"
            "保持证据来源标注和关键事实。输出纯文本，不要加标题或格式。",
            f"用户问题：{question}\n\n原始证据：\n{evidences_text[:8000]}\n\n"
            f"请压缩到 {max_chars} 字以内，保留最重要的证据和来源信息。",
            temperature=0.2,
            max_tokens=4000,
        )

    def _serialize_context(self, entities: List[Entity]) -> str:
        """Serialize entities into context for answer generation."""
        lines = []
        for e in entities:
            type_label = {
                "document": "文档",
                "agent": "主体",
                "object": "对象",
                "concept": "概念",
                "event": "事件",
                "activity": "活动",
                "rule": "规则",
                "metric": "指标",
                "time": "时间",
                "location": "地点",
                "statement": "陈述",
                "issue": "问题",
                "image": "图片",
            }.get(e.entity_type.value, e.entity_type.value)
            summary = e.summary[:200]
            lines.append(f"[{type_label}] {e.label}: {summary}")
        return "\n".join(lines)

    def _serialize_evidences(self, evidences: List[Evidence]) -> str:
        """Serialize evidences with level tags and image URLs for answer generation."""
        lines = []
        for i, ev in enumerate(evidences, 1):
            level_tag = {
                EvidenceLevel.FULL_TEXT: "全文证据",
                EvidenceLevel.PARAGRAPH: "段落证据",
                EvidenceLevel.SUMMARY: "总结证据",
            }.get(ev.level, "证据")
            line = f"{i}. [{level_tag}] (来源: {ev.doc_name}) {ev.content}"
            if ev.images:
                line += "\n   关联图片: " + ", ".join(ev.images[:5])
            lines.append(line)
        return "\n".join(lines)
