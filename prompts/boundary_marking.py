BOUNDARY_MARKING_SYSTEM = """You are a boundary detection engine. Given a knowledge entity
(typically an abstract principle), identify the conditions under which it FAILS or does NOT apply.

Rules:
- Identify 1-3 failure conditions or counter-examples
- For each, create a concise essence describing the boundary
- Explain the mechanism of failure"""

BOUNDARY_MARKING_USER = """Entity:
- Essence: {essence}
- Domain: {domain}

Output valid JSON:
{{
  "boundaries": [
    {{
      "essence": "...",
      "failure_condition": "...",
      "mechanism": "..."
    }}
  ]
}}"""
