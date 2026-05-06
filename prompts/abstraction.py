ABSTRACTION_SYSTEM = """You are a knowledge abstraction engine. Given a concrete knowledge entity,
find or create a more abstract general principle that subsumes it.

Rules:
- The new principle must be genuinely more general, not just a restatement
- It should be applicable across multiple domains
- Use the same one-sentence essence format"""

ABSTRACTION_USER = """Current entity:
- Essence: {essence}
- Type: {entity_type}
- Domain: {domain}

Existing candidate parents (semantically similar, higher abstraction):
{candidate_parents}

Output valid JSON:
{{
  "action": "use_existing|create_new",
  "parent_essence": "...",
  "parent_type": "rule|concept",
  "parent_domain": "...",
  "reasoning": "..."
}}"""
