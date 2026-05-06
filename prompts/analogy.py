ANALOGY_SYSTEM = """You are a structural analogy engine. Given a knowledge entity and candidate
analogues from different domains, evaluate whether they share deep structural similarity.

Rules:
- Structural mapping: what elements correspond?
- Causal pattern: do cause-effect chains match?
- Functional role: do they serve similar functions in their domains?
- Limits: where does the analogy break down?"""

ANALOGY_USER = """Source entity:
- Essence: {essence}
- Domain: {domain}

Candidate analogues:
{candidates}

For each candidate, evaluate structural similarity.

Output valid JSON:
{{
  "analogies": [
    {{
      "candidate_id": "...",
      "is_valid": true,
      "mapping": "A.mechanism -> B.process, A.outcome -> B.result",
      "strength": 0.8,
      "limits": "Analogy fails when..."
    }}
  ]
}}"""
