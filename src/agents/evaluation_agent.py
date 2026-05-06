from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import List, Optional

from src.llm.base import BaseLLM
from src.models.entity import Entity, EntityType
from src.models.relation import Relation, RelationType
from prompts.evaluation import EVALUATION_SYSTEM, EVALUATION_USER

logger = logging.getLogger(__name__)


@dataclass
class EntityEvaluation:
    label: str
    entity_type: str
    final_score: float
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


@dataclass
class RelationEvaluation:
    source_label: str
    target_label: str
    relation_type: str
    final_score: float
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


@dataclass
class EvaluationResult:
    format_valid: bool
    recommendation: str  # "accept" | "revise" | "reject"
    entity_evaluations: List[EntityEvaluation]
    relation_evaluations: List[RelationEvaluation]
    issues: List[str] = field(default_factory=list)
    rejection_reasons: List[str] = field(default_factory=list)

    @property
    def accepted(self) -> bool:
        return self.recommendation == "accept"

    @property
    def rejected(self) -> bool:
        return self.recommendation == "reject"

    @property
    def needs_revision(self) -> bool:
        return self.recommendation == "revise"

    def get_entity_score(self, label: str) -> float:
        """Get the evaluation score for an entity by label."""
        for ev in self.entity_evaluations:
            if ev.label == label:
                return ev.final_score
        return 0.0

    def get_relation_score(self, source: str, target: str, rel_type: str) -> float:
        """Get the evaluation score for a relation."""
        for rv in self.relation_evaluations:
            if rv.source_label == source and rv.target_label == target and rv.relation_type == rel_type:
                return rv.final_score
        return 0.0


class EvaluationAgent:
    """Post-extraction evaluation agent.

    Validates format, scores confidence for entities and relations,
    and filters out low-quality results (score < 0.7).
    """

    def __init__(self, llm: BaseLLM):
        self._llm = llm

    @staticmethod
    def _ensure_str_list(val) -> List[str]:
        """Ensure value is a flat list of strings (LLM may return nested lists)."""
        if not isinstance(val, list):
            return [str(val)] if val else []
        result = []
        for item in val:
            if isinstance(item, list):
                for sub in item:
                    result.append(str(sub) if not isinstance(sub, str) else sub)
            else:
                result.append(str(item) if not isinstance(item, str) else item)
        return result

    def validate_format(self, entities: List[Entity], relations: List[Relation]) -> tuple[bool, List[str]]:
        """Check if extraction result has correct format before LLM evaluation."""
        issues = []

        if not entities:
            issues.append("抽取结果为空，未发现任何实体")
            return False, issues

        for e in entities:
            if not e.label or not e.label.strip():
                issues.append(f"实体缺少 label")
            if not e.summary or not e.summary.strip():
                issues.append(f"实体 '{e.label}' 缺少 summary")
            if not e.entity_type:
                issues.append(f"实体 '{e.label}' 缺少 entity_type")
            try:
                EntityType(e.entity_type.value)
            except (ValueError, AttributeError):
                issues.append(f"实体 '{e.label}' 的 entity_type '{e.entity_type}' 不合法")

        for r in relations:
            if not r.source_id:
                issues.append(f"关系缺少 source_id")
            if not r.target_id:
                issues.append(f"关系缺少 target_id")
            try:
                RelationType(r.relation_type.value)
            except (ValueError, AttributeError):
                issues.append(f"关系的 relation_type '{r.relation_type}' 不合法")

        return len(issues) == 0, issues

    async def evaluate(
        self,
        document_text: str,
        entities: List[Entity],
        relations: List[Relation],
    ) -> EvaluationResult:
        """Evaluate extraction results using LLM."""

        # Step 1: Format validation
        format_valid, format_issues = self.validate_format(entities, relations)
        if not format_valid:
            logger.warning(f"[评估] 格式校验失败: {format_issues}")
            return EvaluationResult(
                format_valid=False,
                recommendation="reject",
                entity_evaluations=[],
                relation_evaluations=[],
                issues=format_issues,
                rejection_reasons=["抽取结果格式不正确，需要重新抽取"] + format_issues,
            )
        logger.info(f"[评估] 格式校验通过，开始 LLM 评估 ({len(entities)} 实体, {len(relations)} 关系)")

        # Step 2: Build extraction result for LLM
        extraction_data = {
            "entities": [
                {
                    "label": e.label,
                    "type": e.entity_type.value,
                    "subtype": e.subtype or "",
                    "summary": e.summary,
                }
                for e in entities
            ],
            "relations": [
                {
                    "source_label": self._find_label(entities, r.source_id),
                    "target_label": self._find_label(entities, r.target_id),
                    "type": r.relation_type.value,
                }
                for r in relations
            ],
        }
        extraction_json = json.dumps(extraction_data, ensure_ascii=False, indent=2)

        # Step 3: LLM evaluation
        result = await self._llm.complete_json(
            EVALUATION_SYSTEM,
            EVALUATION_USER.format(
                document_text=document_text[:6000],
                extraction_result=extraction_json,
            ),
        )

        # Step 4: Parse result
        overall = result.get("overall_assessment", {})
        recommendation = result.get("recommendation", "reject")

        entity_evals = []
        for ev in result.get("entity_evaluations", []):
            entity_evals.append(EntityEvaluation(
                label=str(ev.get("label", "")),
                entity_type=str(ev.get("entity_type", "")),
                final_score=float(ev.get("final_score", 0.0)),
                issues=self._ensure_str_list(ev.get("issues", [])),
                suggestions=self._ensure_str_list(ev.get("suggestions", [])),
            ))

        relation_evals = []
        for rv in result.get("relation_evaluations", []):
            relation_evals.append(RelationEvaluation(
                source_label=str(rv.get("source_label", "")),
                target_label=str(rv.get("target_label", "")),
                relation_type=str(rv.get("relation_type", "")),
                final_score=float(rv.get("final_score", 0.0)),
                issues=self._ensure_str_list(rv.get("issues", [])),
                suggestions=self._ensure_str_list(rv.get("suggestions", [])),
            ))

        # Log evaluation summary
        logger.info(f"[评估] LLM 评估完成: recommendation={recommendation}")
        if entity_evals:
            score_summary = [f"'{e.label}'={e.final_score}" for e in entity_evals]
            logger.info(f"[评估] 实体评分: {', '.join(score_summary)}")
        if relation_evals:
            score_summary = [f"'{r.source_label}'→'{r.target_label}'({r.relation_type})={r.final_score}" for r in relation_evals]
            logger.info(f"[评估] 关系评分: {', '.join(score_summary)}")
        if overall.get("issues"):
            logger.info(f"[评估] 问题: {overall.get('issues')}")
        if result.get("rejection_reasons"):
            logger.warning(f"[评估] 拒绝原因: {result.get('rejection_reasons')}")

        return EvaluationResult(
            format_valid=overall.get("format_valid", True),
            recommendation=recommendation,
            entity_evaluations=entity_evals,
            relation_evaluations=relation_evals,
            issues=self._ensure_str_list(overall.get("issues", [])),
            rejection_reasons=self._ensure_str_list(result.get("rejection_reasons", [])),
        )

    def apply_scores(
        self,
        entities: List[Entity],
        relations: List[Relation],
        evaluation: EvaluationResult,
    ) -> tuple[List[Entity], List[Relation], List[str]]:
        """Apply evaluation scores to entities and relations, filter out low-quality ones.

        Returns (accepted_entities, accepted_relations, rejection_messages).
        """
        accepted_entities = []
        rejected_labels = set()
        messages = []

        for entity in entities:
            score = evaluation.get_entity_score(entity.label)
            if score < 0.7:
                rejected_labels.add(entity.label)
                issue_parts = []
                for ev in evaluation.entity_evaluations:
                    if ev.label == entity.label:
                        for iss in ev.issues:
                            issue_parts.append(str(iss) if not isinstance(iss, str) else iss)
                issues_str = "; ".join(issue_parts)
                msg = f"实体 '{entity.label}' ({entity.entity_type.value}) 评分 {score}，已弃用。原因: {issues_str}"
                messages.append(msg)
                logger.info(f"[过滤] ✗ {msg}")
            else:
                entity.confidence = score
                accepted_entities.append(entity)
                logger.info(f"[过滤] ✓ 实体 '{entity.label}' ({entity.entity_type.value}) 评分 {score}")

        # Build set of accepted entity ids
        accepted_ids = {e.id for e in accepted_entities}

        accepted_relations = []
        for rel in relations:
            src_label = self._find_label(entities, rel.source_id)
            tgt_label = self._find_label(entities, rel.target_id)
            score = evaluation.get_relation_score(src_label, tgt_label, rel.relation_type.value)

            # Also reject if either endpoint entity was rejected
            if rel.source_id not in accepted_ids or rel.target_id not in accepted_ids:
                msg = f"关系 '{src_label}' → '{tgt_label}' ({rel.relation_type.value}) 因端点实体被弃用而一并弃用"
                messages.append(msg)
                logger.info(f"[过滤] ✗ {msg}")
                continue

            if score < 0.7:
                issue_parts = []
                for rv in evaluation.relation_evaluations:
                    if rv.source_label == src_label and rv.target_label == tgt_label:
                        for iss in rv.issues:
                            issue_parts.append(str(iss) if not isinstance(iss, str) else iss)
                issues_str = "; ".join(issue_parts)
                msg = f"关系 '{src_label}' → '{tgt_label}' ({rel.relation_type.value}) 评分 {score}，已弃用。原因: {issues_str}"
                messages.append(msg)
                logger.info(f"[过滤] ✗ {msg}")
            else:
                rel.confidence = score
                accepted_relations.append(rel)
                logger.info(f"[过滤] ✓ 关系 '{src_label}' → '{tgt_label}' ({rel.relation_type.value}) 评分 {score}")

        logger.info(
            f"[过滤] 结果: 实体 {len(entities)}→{len(accepted_entities)}, "
            f"关系 {len(relations)}→{len(accepted_relations)}"
        )
        return accepted_entities, accepted_relations, messages

    def _find_label(self, entities: List[Entity], entity_id: str) -> str:
        """Find entity label by id."""
        for e in entities:
            if e.id == entity_id:
                return e.label
        return entity_id
