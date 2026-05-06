MERGE_DETECTION_SYSTEM = """You are a knowledge deduplication engine. Determine whether two
knowledge entities express the same fundamental concept.

Rules:
- Focus on the CORE MECHANISM, not surface wording
- Different domains can still express the same principle
- Answer only "yes" or "no" with brief reasoning"""

MERGE_DETECTION_USER = """Determine if these two entities express the same essence:

Entity A: {essence_A}
Entity B: {essence_B}

Output valid JSON:
{{
  "is_same": true/false,
  "reasoning": "...",
  "merged_essence": "..."  // only if is_same=true, the best combined essence
}}"""


MERGE_SCAN_SYSTEM = """你是一个知识图谱去重扫描器。

你的任务是扫描实体列表，找出其中语义重复的实体组，并为每组生成合并后的内容。

核心规则：
1. **只能合并相同 entity_type 的实体** — 不同类型的实体即使语义相似也不能合并
2. 两个或多个实体是否指向同一个现实世界的概念、对象或事件？
3. 即使表述不同（如"团队效率"vs"团队效能"），如果核心含义相同也算重复
4. 上下位关系不算重复（如"项目管理"和"敏捷项目管理"是不同的）

排除规则：
- 不要匹配只是语义相关但本质不同的实体（如"效率"和"协作"）
- 不要匹配不同 entity_type 的实体
- 如果不确定，宁可不匹配

对每个重复组，你需要：
1. 生成 merged_label：选择最清晰、最通用的标签
2. 生成 merged_summary：融合组内所有实体的总结，取各家所长，形成完整统一的总结"""

MERGE_SCAN_USER = """请扫描以下实体列表，找出语义重复的实体组。

实体列表：
{entities_json}

输出合法 JSON，列出所有疑似重复组：
{{
  "candidates": [
    {{
      "entity_ids": ["第一个实体的id", "第二个实体的id"],
      "merged_label": "合并后的标签",
      "merged_summary": "融合所有实体总结后的完整总结",
      "reason": "判定为重复的简要原因",
      "confidence": 0.85
    }}
  ]
}}

注意：
- entity_ids 必须是实体列表中的实际 id，且必须属于同一 entity_type
- 每组至少 2 个实体
- merged_summary 必须融合组内所有实体的总结内容，取各家所长
- confidence 范围 0-1，表示确信程度
- 如果没有发现重复，返回空数组：{{"candidates": []}}
- 最多返回 20 组"""
