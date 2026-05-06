CONCRETIZATION_SYSTEM = """You are a knowledge concretization engine. Given an abstract principle,
generate concrete instances from different domains.

Rules:
- Each instance must be a real, plausible scenario
- Each must come from a DIFFERENT domain
- Each instance should clearly embody the abstract principle
- Use the one-sentence essence format"""

CONCRETIZATION_USER = """Abstract principle:
- Essence: {essence}
- Domain: {domain}

Generate {num_instances} concrete instances from different domains.

Output valid JSON:
{{
  "instances": [
    {{
      "essence": "...",
      "domain": "...",
      "tags": ["...", "..."]
    }}
  ]
}}"""
