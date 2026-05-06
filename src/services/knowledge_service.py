from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Callable, List, Optional

from src.agents.evaluation_agent import EvaluationAgent
from src.agents.feynman_agent import FeynmanAgent
from src.agents.retrieval_agent import RetrievalAgent
from src.models.entity import Entity
from src.models.graph import ActivationResult
from src.models.relation import Relation

logger = logging.getLogger(__name__)

# Type for progress callback: receives (progress_percent, message)
ProgressCallback = Optional[Callable[[int, str], None]]

MAX_RETRIES = 2


@dataclass
class IngestResult:
    entities: List[Entity]
    relations: List[Relation]
    evaluation_issues: List[str] = field(default_factory=list)
    retries: int = 0


class KnowledgeService:
    def __init__(
        self,
        feynman: FeynmanAgent,
        retrieval: RetrievalAgent,
        evaluator: EvaluationAgent,
        entity_search=None,
    ):
        self._feynman = feynman
        self._retrieval = retrieval
        self._evaluator = evaluator
        self._entity_search = entity_search

    async def ingest(
        self,
        text: str,
        doc_id: int | None = None,
        doc_name: str | None = None,
        on_progress: ProgressCallback = None,
    ) -> IngestResult:
        """Extract, evaluate, and filter entities/relations from document text.

        Pipeline:
        1. Extract with FeynmanAgent
        2. Validate format
        3. Evaluate with EvaluationAgent (LLM scoring)
        4. Filter out entities/relations with score < 0.7
        5. If too many rejected, retry extraction (up to MAX_RETRIES)
        6. Write accepted results to graph store
        """
        def progress(pct: int, msg: str):
            if on_progress:
                on_progress(pct, msg)
                logger.info(f"[进度] {pct}% - {msg}")

        all_issues: List[str] = []
        retries = 0

        for attempt in range(MAX_RETRIES + 1):
            logger.info(f"[知识入库] ══ 开始第 {attempt + 1}/{MAX_RETRIES + 1} 次尝试 ══")

            # Step 1: Extract
            progress(10, "正在抽取实体和关系...")
            entities, relations = await self._feynman.extract(
                text, doc_id=doc_id, doc_name=doc_name,
            )
            progress(40, f"抽取完成: {len(entities)}个实体, {len(relations)}个关系")

            if not entities:
                logger.warning(f"[知识入库] 抽取未产生任何实体，终止")
                return IngestResult(
                    entities=[], relations=[],
                    evaluation_issues=["抽取未产生任何实体"],
                    retries=attempt,
                )

            # Step 2: Evaluate
            progress(50, "正在评估抽取质量...")
            try:
                evaluation = await self._evaluator.evaluate(text, entities, relations)
            except Exception as e:
                logger.error(f"[知识入库] 评估失败 (attempt {attempt + 1}): {e}")
                all_issues.append(f"评估失败: {e}")
                if attempt < MAX_RETRIES:
                    logger.info("[知识入库] 评估失败，3秒后重试...")
                    import asyncio
                    await asyncio.sleep(3)
                    continue
                logger.error(f"[知识入库] 评估在所有重试后仍失败，跳过写入图谱")
                return IngestResult(
                    entities=[], relations=[],
                    evaluation_issues=all_issues,
                    retries=attempt + 1,
                )

            # Step 3: Handle format errors — retry extraction
            if not evaluation.format_valid:
                all_issues.extend(evaluation.issues)
                logger.warning(f"[知识入库] 格式校验失败 (attempt {attempt + 1}): {evaluation.issues}")
                retries = attempt + 1
                continue

            # Step 4: Handle reject — retry extraction
            if evaluation.rejected:
                all_issues.extend(evaluation.rejection_reasons)
                logger.warning(f"[知识入库] 评估拒绝 (attempt {attempt + 1}): {evaluation.rejection_reasons}")
                retries = attempt + 1
                continue

            # Step 5: Apply scores and filter
            progress(70, "正在过滤和评分...")
            accepted_entities, accepted_relations, filter_messages = self._evaluator.apply_scores(
                entities, relations, evaluation,
            )
            all_issues.extend(filter_messages)
            progress(80, f"过滤完成: 保留{len(accepted_entities)}个实体, {len(accepted_relations)}个关系")

            # Step 6: If too many entities rejected (>50%), retry
            if len(accepted_entities) < len(entities) * 0.5 and attempt < MAX_RETRIES:
                rejection_ratio = 1 - len(accepted_entities) / len(entities)
                all_issues.append(
                    f"第 {attempt + 1} 次抽取：{rejection_ratio:.0%} 实体被弃用，重新抽取"
                )
                logger.warning(f"[知识入库] 弃用率 {rejection_ratio:.0%} 过高，重新抽取")
                retries = attempt + 1
                continue

            # Step 7: Write accepted results to graph store
            progress(90, "正在写入图谱...")
            total = len(accepted_entities) + len(accepted_relations)
            written_entities = []
            for i, entity in enumerate(accepted_entities):
                await self._feynman._graph.create_entity(entity)
                written_entities.append(entity)
                # Populate search index with rollback on failure
                if self._entity_search:
                    try:
                        self._entity_search.populate_terms(entity)
                    except Exception as e:
                        logger.error(f"[知识入库] 搜索索引写入失败，回滚实体 {entity.id}: {e}")
                        await self._feynman._graph.delete_entity(entity.id)
                        raise
                if total > 0 and (i + 1) % max(1, total // 5) == 0:
                    pct = 90 + int(10 * (i + 1) / total)
                    progress(min(pct, 99), f"写入实体 {i+1}/{len(accepted_entities)}")
            for rel in accepted_relations:
                await self._feynman._graph.create_relation(rel)
            progress(100, "完成")

            logger.info(
                f"[知识入库] ══ 完成: {len(accepted_entities)} 个实体, "
                f"{len(accepted_relations)} 个关系写入图谱"
                f"{f', 重试 {retries} 次' if retries else ''} ══"
            )

            return IngestResult(
                entities=accepted_entities,
                relations=accepted_relations,
                evaluation_issues=all_issues,
                retries=retries,
            )

        # All retries exhausted
        return IngestResult(
            entities=[], relations=[],
            evaluation_issues=all_issues + [f"已重试 {MAX_RETRIES} 次，仍无法通过评估"],
            retries=retries,
        )

    async def query(
        self,
        question: str,
        max_depth: int = 2,
    ) -> ActivationResult:
        return await self._retrieval.retrieve(
            question, max_depth=max_depth,
        )
