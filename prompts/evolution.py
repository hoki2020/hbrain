EVOLUTION_SYSTEM = """You are a knowledge evolution engine. Analyze a set of knowledge entities
and suggest improvements to the knowledge graph.

Tasks:
- Identify redundant entities that should be merged
- Suggest new connections between related entities
- Identify entities that may be outdated or need refinement"""

EVOLUTION_USER = """Analyze these entities and suggest improvements:

{entities_summary}

Output valid JSON:
{{
  "merge_candidates": [
    {{
      "entity_ids": ["id1", "id2"],
      "reasoning": "..."
    }}
  ],
  "suggested_connections": [
    {{
      "source_id": "...",
      "target_id": "...",
      "relation_type": "ANALOGOUS_TO|CAUSES|CONNECTED_TO",
      "reasoning": "..."
    }}
  ],
  "outdated_entities": [
    {{
      "entity_id": "...",
      "reasoning": "..."
    }}
  ]
}}"""
