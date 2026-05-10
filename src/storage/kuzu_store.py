from __future__ import annotations

import asyncio
import json
import os
import time
from typing import List, Optional

import kuzu

from src.models.entity import Entity, EntitySource, EntityType
from src.models.graph import SubGraph
from src.models.relation import Relation, RelationType
from src.storage.interfaces import GraphStore

_RELATION_TYPE_VALUES = [t.value for t in RelationType]


class KuzuStore(GraphStore):
    def __init__(self, db_path: str):
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self._db = kuzu.Database(db_path)
        self._ensure_schema()
        self._migrate_relation_types()
        self._adj_cache: dict | None = None
        self._adj_cache_time: float = 0
        self._write_lock = asyncio.Lock()

    def _get_conn(self) -> kuzu.Connection:
        """Create a fresh connection per call — Kuzu Connection is not thread-safe."""
        return kuzu.Connection(self._db)

    def close(self):
        if self._db is not None:
            self._db.close()
            self._db = None

    async def _run_sync(self, func):
        return await asyncio.to_thread(func)

    # ── Schema ─────────────────────────────────────────────

    def _ensure_schema(self):
        conn = self._get_conn()
        conn.execute(
            """CREATE NODE TABLE IF NOT EXISTS Entity(
                id STRING PRIMARY KEY,
                label STRING,
                summary STRING,
                entity_type STRING,
                subtype STRING,
                confidence DOUBLE,
                sources STRING,
                updated_at TIMESTAMP
            )"""
        )
        for rel_type in _RELATION_TYPE_VALUES:
            conn.execute(
                f"CREATE REL TABLE IF NOT EXISTS REL_{rel_type}"
                f"(FROM Entity TO Entity, weight DOUBLE, confidence DOUBLE)"
            )

    def _migrate_relation_types(self):
        """Migrate old attribute relation tables into REL_attribute, then drop old tables."""
        import logging
        logger = logging.getLogger(__name__)
        conn = self._get_conn()
        old_types = ["has_value", "located_in", "happens_at", "valid_during"]
        for old_type in old_types:
            old_table = f"REL_{old_type}"
            try:
                result = conn.execute(f"MATCH ()-[r:{old_table}]->() RETURN count(*)")
                count = result.get_next()[0]
                if count > 0:
                    conn.execute(
                        f"MATCH (a:Entity)-[r:{old_table}]->(b:Entity) "
                        f"CREATE (a)-[:REL_attribute {{weight: r.weight, confidence: r.confidence}}]->(b)"
                    )
                    # Delete old edges before dropping table (DROP only removes schema, not edges)
                    conn.execute(f"MATCH (a:Entity)-[r:{old_table}]->(b:Entity) DELETE r")
                    logger.info(f"[迁移] {old_table} → REL_attribute: {count} 条边")
                conn.execute(f"DROP TABLE IF EXISTS {old_table}")
            except Exception as e:
                logger.debug(f"[迁移] 跳过 {old_table}: {e}")

    # ── Entity CRUD ────────────────────────────────────────

    async def create_entity(self, entity: Entity) -> str:
        from datetime import datetime, timezone
        sources_json = json.dumps(
            [s.model_dump(mode="json") for s in entity.sources],
            ensure_ascii=False,
        )
        now = datetime.now(timezone.utc).isoformat()

        def _exec():
            conn = self._get_conn()
            check = conn.execute(
                "MATCH (e:Entity {id: $id}) RETURN e.id",
                {"id": entity.id},
            )
            if check.has_next():
                conn.execute(
                    """MATCH (e:Entity {id: $id})
                       SET e.label = $label,
                           e.summary = $summary,
                           e.entity_type = $entity_type,
                           e.subtype = $subtype,
                           e.confidence = $confidence,
                           e.sources = $sources,
                           e.updated_at = timestamp($now)""",
                    {
                        "id": entity.id,
                        "label": entity.label,
                        "summary": entity.summary,
                        "entity_type": entity.entity_type.value,
                        "subtype": entity.subtype or "",
                        "confidence": entity.confidence,
                        "sources": sources_json,
                        "now": now,
                    },
                )
            else:
                conn.execute(
                    """CREATE (e:Entity {
                        id: $id,
                        label: $label,
                        summary: $summary,
                        entity_type: $entity_type,
                        subtype: $subtype,
                        confidence: $confidence,
                        sources: $sources,
                        updated_at: timestamp($now)
                    })""",
                    {
                        "id": entity.id,
                        "label": entity.label,
                        "summary": entity.summary,
                        "entity_type": entity.entity_type.value,
                        "subtype": entity.subtype or "",
                        "confidence": entity.confidence,
                        "sources": sources_json,
                        "now": now,
                    },
                )
            return entity.id

        async with self._write_lock:
            result = await self._run_sync(_exec)
        self.invalidate_adj_cache()
        return result

    async def get_entity(self, entity_id: str) -> Optional[Entity]:
        def _exec():
            result = self._get_conn().execute(
                "MATCH (e:Entity {id: $id}) RETURN e.*",
                {"id": entity_id},
            )
            if not result.has_next():
                return None
            row = result.get_next()
            return self._row_to_entity(row, result.get_column_names())

        return await self._run_sync(_exec)

    async def update_entity(self, entity: Entity) -> None:
        from datetime import datetime, timezone
        sources_json = json.dumps(
            [s.model_dump(mode="json") for s in entity.sources],
            ensure_ascii=False,
        )
        now = datetime.now(timezone.utc).isoformat()

        def _exec():
            conn = self._get_conn()
            conn.execute(
                """MATCH (e:Entity {id: $id})
                   SET e.label = $label,
                       e.summary = $summary,
                       e.entity_type = $entity_type,
                       e.subtype = $subtype,
                       e.confidence = $confidence,
                       e.sources = $sources,
                       e.updated_at = $now""",
                {
                    "id": entity.id,
                    "label": entity.label,
                    "summary": entity.summary,
                    "entity_type": entity.entity_type.value,
                    "subtype": entity.subtype or "",
                    "confidence": entity.confidence,
                    "sources": sources_json,
                    "now": now,
                },
            )

        async with self._write_lock:
            await self._run_sync(_exec)
        self.invalidate_adj_cache()

    async def delete_entity(self, entity_id: str) -> None:
        def _exec():
            conn = self._get_conn()
            for rel_type in _RELATION_TYPE_VALUES:
                conn.execute(
                    f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                    f"WHERE a.id = $id OR b.id = $id DELETE r",
                    {"id": entity_id},
                )
            conn.execute(
                "MATCH (e:Entity {id: $id}) DELETE e",
                {"id": entity_id},
            )

        async with self._write_lock:
            await self._run_sync(_exec)
        self.invalidate_adj_cache()

    async def delete_all(self) -> None:
        def _exec():
            conn = self._get_conn()
            for rel_type in _RELATION_TYPE_VALUES:
                conn.execute(
                    f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) DELETE r"
                )
            conn.execute("MATCH (e:Entity) DELETE e")

        async with self._write_lock:
            await self._run_sync(_exec)
        self.invalidate_adj_cache()

    async def delete_by_doc(self, doc_id: int) -> tuple[int, List[str], List[str]]:
        """Remove entities/relations extracted from *doc_id*.

        Returns (deleted_count, deleted_entity_ids, updated_entity_ids).
        """
        def _exec():
            conn = self._get_conn()
            result = conn.execute(
                "MATCH (e:Entity) RETURN e.id, e.sources"
            )
            to_delete: List[str] = []
            to_update: List[tuple] = []  # (entity_id, new_sources_json)

            while result.has_next():
                row = result.get_next()
                eid = row[0]
                sources_raw = row[1] or "[]"
                if isinstance(sources_raw, str):
                    sources = json.loads(sources_raw)
                else:
                    sources = sources_raw

                matching = [s for s in sources if s.get("doc_id") == doc_id]
                if not matching:
                    continue

                remaining = [s for s in sources if s.get("doc_id") != doc_id]
                if remaining:
                    to_update.append((eid, json.dumps(remaining, ensure_ascii=False)))
                else:
                    to_delete.append(eid)

            # Update entities that have other sources
            for eid, new_sources in to_update:
                conn.execute(
                    "MATCH (e:Entity {id: $id}) SET e.sources = $sources",
                    {"id": eid, "sources": new_sources},
                )

            # Delete entities whose only source was this doc
            for eid in to_delete:
                for rel_type in _RELATION_TYPE_VALUES:
                    conn.execute(
                        f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                        f"WHERE a.id = $id OR b.id = $id DELETE r",
                        {"id": eid},
                    )
                conn.execute(
                    "MATCH (e:Entity {id: $id}) DELETE e",
                    {"id": eid},
                )

            updated_ids = [eid for eid, _ in to_update]
            return len(to_delete), to_delete, updated_ids

        async with self._write_lock:
            result = await self._run_sync(_exec)
        self.invalidate_adj_cache()
        return result

    # ── Relation CRUD ──────────────────────────────────────

    async def create_relation(self, relation: Relation) -> None:
        rel_table = f"REL_{relation.relation_type.value}"
        query = (
            f"MATCH (a:Entity {{id: $src}}), (b:Entity {{id: $tgt}}) "
            f"CREATE (a)-[r:{rel_table}]->(b) "
            f"SET r.weight = $weight, r.confidence = $confidence"
        )

        def _exec():
            self._get_conn().execute(
                query,
                {
                    "src": relation.source_id,
                    "tgt": relation.target_id,
                    "weight": relation.weight,
                    "confidence": relation.confidence,
                },
            )

        async with self._write_lock:
            await self._run_sync(_exec)
        self.invalidate_adj_cache()

    # ── Graph Traversal ────────────────────────────────────

    async def get_neighbors(
        self,
        entity_id: str,
        relation_types: Optional[List[RelationType]] = None,
        direction: str = "both",
        max_depth: int = 1,
    ) -> SubGraph:
        if direction == "outgoing":
            pattern = f"-[r*1..{max_depth}]->(neighbor)"
        elif direction == "incoming":
            pattern = f"<-[r*1..{max_depth}]-(neighbor)"
        else:
            pattern = f"-[r*1..{max_depth}]-(neighbor)"

        query = f"MATCH (center:Entity {{id: $id}}){pattern} RETURN DISTINCT neighbor"

        def _exec():
            result = self._get_conn().execute(query, {"id": entity_id})
            entities = []
            seen = set()
            while result.has_next():
                row = result.get_next()
                neighbor_dict = row[0]
                eid = neighbor_dict.get("id", "")
                if eid and eid not in seen:
                    seen.add(eid)
                    entities.append(self._dict_to_entity(neighbor_dict))
            return entities

        entities = await self._run_sync(_exec)
        entity_ids = [entity_id] + [e.id for e in entities]
        relations = await self._get_relations_between(entity_ids)

        if relation_types:
            allowed = {t.value for t in relation_types}
            relations = [r for r in relations if r.relation_type.value in allowed]

        return SubGraph(
            entities=entities,
            relations=relations,
            center_entity_ids=[entity_id],
            depth=max_depth,
        )

    async def _get_relations_between(self, entity_ids: List[str]) -> List[Relation]:
        if len(entity_ids) < 2:
            return []

        def _exec():
            conn = self._get_conn()
            relations = []
            for rel_type in _RELATION_TYPE_VALUES:
                query = (
                    f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                    f"WHERE a.id IN $ids AND b.id IN $ids "
                    f"RETURN a.id, b.id, r.weight, r.confidence"
                )
                result = conn.execute(query, {"ids": entity_ids})
                while result.has_next():
                    row = result.get_next()
                    relations.append(Relation(
                        source_id=row[0],
                        target_id=row[1],
                        relation_type=RelationType(rel_type),
                        weight=row[2] if row[2] is not None else 1.0,
                        confidence=row[3] if row[3] is not None else 0.5,
                    ))
            return relations

        return await self._run_sync(_exec)

    async def find_by_type(self, entity_type: str, limit: int = 100) -> List[Entity]:
        def _exec():
            result = self._get_conn().execute(
                "MATCH (e:Entity) WHERE e.entity_type = $entity_type RETURN e.* LIMIT $limit",
                {"entity_type": entity_type, "limit": limit},
            )
            return self._collect_entities(result)

        return await self._run_sync(_exec)

    async def find_path(
        self, source_id: str, target_id: str, max_depth: int = 5
    ) -> Optional[List[str]]:
        query = (
            f"MATCH p = shortestPath((a:Entity {{id: $src}})-[*1..{max_depth}]-(b:Entity {{id: $tgt}})) "
            f"RETURN p"
        )

        def _exec():
            result = self._get_conn().execute(query, {"src": source_id, "tgt": target_id})
            if not result.has_next():
                return None
            row = result.get_next()
            path = row[0]
            if isinstance(path, dict) and "nodes" in path:
                return [n.get("id", n.get("Entity.id", "")) for n in path["nodes"]]
            return [source_id, target_id]

        return await self._run_sync(_exec)

    # ── Relation-specific traversal ────────────────────────

    async def get_related(
        self, entity_id: str, relation_type: RelationType, direction: str = "outgoing"
    ) -> List[Entity]:
        rel_table = f"REL_{relation_type.value}"
        if direction == "outgoing":
            query = (
                f"MATCH (e:Entity {{id: $id}})-[r:{rel_table}]->(target:Entity) "
                f"RETURN target.*"
            )
        else:
            query = (
                f"MATCH (e:Entity {{id: $id}})<-[r:{rel_table}]-(target:Entity) "
                f"RETURN target.*"
            )

        def _exec():
            result = self._get_conn().execute(query, {"id": entity_id})
            return self._collect_entities(result)

        return await self._run_sync(_exec)

    # ── Text Search ────────────────────────────────────────

    # ── Batch Operations ───────────────────────────────────

    async def get_all_entities(self, limit: int = 500) -> List[Entity]:
        def _exec():
            result = self._get_conn().execute(
                "MATCH (e:Entity) RETURN e.* LIMIT $limit",
                {"limit": limit},
            )
            return self._collect_entities(result)

        return await self._run_sync(_exec)

    async def get_entities_by_ids(self, entity_ids: List[str]) -> List[Entity]:
        if not entity_ids:
            return []

        def _exec():
            safe_ids = [eid.replace("'", "''") for eid in entity_ids]
            ids_str = ", ".join(f"'{eid}'" for eid in safe_ids)
            result = self._get_conn().execute(
                f"MATCH (e:Entity) WHERE e.id IN [{ids_str}] RETURN e.*"
            )
            return self._collect_entities(result)

        return await self._run_sync(_exec)

    async def get_all_relations(self, limit: int = 1000) -> List[Relation]:
        def _exec():
            subqueries = []
            for rel_type in _RELATION_TYPE_VALUES:
                subqueries.append(
                    f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                    f"RETURN a.id AS src, b.id AS tgt, "
                    f"'{rel_type}' AS rel_type, r.weight AS weight, r.confidence AS conf"
                )
            query = " UNION ALL ".join(subqueries)
            result = self._get_conn().execute(query)
            relations = []
            count = 0
            while result.has_next() and count < limit:
                row = result.get_next()
                relations.append(Relation(
                    source_id=row[0],
                    target_id=row[1],
                    relation_type=RelationType(row[2]),
                    weight=row[3] if row[3] is not None else 1.0,
                    confidence=row[4] if row[4] is not None else 0.5,
                ))
                count += 1
            return relations

        return await self._run_sync(_exec)

    async def get_adjacency(self, ttl: int = 300) -> dict[str, list[tuple[str, str, float, float]]]:
        """Return cached adjacency list: entity_id → [(neighbor_id, rel_type, weight, confidence)].

        Cache is refreshed every `ttl` seconds. Call invalidate_adj_cache() after writes.
        """
        if self._adj_cache is not None and time.time() - self._adj_cache_time < ttl:
            return self._adj_cache

        def _exec():
            from collections import defaultdict
            adj: dict[str, list[tuple[str, str, float, float]]] = defaultdict(list)
            for rel_type in _RELATION_TYPE_VALUES:
                result = self._get_conn().execute(
                    f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                    f"RETURN a.id, b.id, r.weight, r.confidence"
                )
                while result.has_next():
                    row = result.get_next()
                    src, tgt = row[0], row[1]
                    w = row[2] if row[2] is not None else 1.0
                    c = row[3] if row[3] is not None else 0.5
                    adj[src].append((tgt, rel_type, w, c))
                    adj[tgt].append((src, rel_type, w, c))
            return dict(adj)

        adj = await self._run_sync(_exec)
        self._adj_cache = adj
        self._adj_cache_time = time.time()
        return adj

    def invalidate_adj_cache(self):
        """Invalidate the adjacency cache. Call after write operations."""
        self._adj_cache = None
        self._adj_cache_time = 0

    # ── Stats ──────────────────────────────────────────────

    async def get_entity_count(self) -> int:
        def _exec():
            result = self._get_conn().execute("MATCH (e:Entity) RETURN count(e)")
            return result.get_next()[0]

        return await self._run_sync(_exec)

    async def get_relation_count(self) -> int:
        def _exec():
            conn = self._get_conn()
            total = 0
            for rel_type in _RELATION_TYPE_VALUES:
                result = conn.execute(
                    f"MATCH ()-[r:REL_{rel_type}]->() RETURN count(r)"
                )
                total += result.get_next()[0]
            return total

        return await self._run_sync(_exec)

    # ── Merge Operations ─────────────────────────────────

    async def get_entity_relations(self, entity_id: str) -> List[dict]:
        """Get all relations involving an entity, with direction info."""

        def _exec():
            conn = self._get_conn()
            relations = []
            for rel_type in _RELATION_TYPE_VALUES:
                # Outgoing: entity is source
                out_query = (
                    f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                    f"WHERE a.id = $id "
                    f"RETURN a.id, b.id, r.weight, r.confidence, 'outgoing'"
                )
                result = conn.execute(out_query, {"id": entity_id})
                while result.has_next():
                    row = result.get_next()
                    relations.append({
                        "from_id": row[0],
                        "to_id": row[1],
                        "rel_type": rel_type,
                        "weight": row[2] if row[2] is not None else 1.0,
                        "confidence": row[3] if row[3] is not None else 0.5,
                        "direction": row[4],
                    })

                # Incoming: entity is target
                in_query = (
                    f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                    f"WHERE b.id = $id "
                    f"RETURN a.id, b.id, r.weight, r.confidence, 'incoming'"
                )
                result = conn.execute(in_query, {"id": entity_id})
                while result.has_next():
                    row = result.get_next()
                    relations.append({
                        "from_id": row[0],
                        "to_id": row[1],
                        "rel_type": rel_type,
                        "weight": row[2] if row[2] is not None else 1.0,
                        "confidence": row[3] if row[3] is not None else 0.5,
                        "direction": row[4],
                    })
            return relations

        return await self._run_sync(_exec)

    async def merge_entity_group(self, new_entity_id: str, absorbed_ids: List[str]) -> dict:
        """Migrate relations from multiple absorbed entities to a new entity, then delete them.

        - Skips intra-group relations (both endpoints in absorbed_ids).
        - Skips self-loops (endpoint == new_entity_id).
        - Deduplicates parallel edges (same rel_type + same target).
        """
        absorbed_set = set(absorbed_ids)

        def _exec():
            conn = self._get_conn()
            migrated = 0
            deleted = 0

            for rel_type in _RELATION_TYPE_VALUES:
                # Collect all outgoing edges from absorbed entities
                for absorbed_id in absorbed_ids:
                    result = conn.execute(
                        f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                        f"WHERE a.id = $aid "
                        f"RETURN b.id, r.weight, r.confidence",
                        {"aid": absorbed_id},
                    )
                    rows = []
                    while result.has_next():
                        rows.append(result.get_next())

                    for row in rows:
                        other_id = row[0]
                        weight = row[1] if row[1] is not None else 1.0
                        confidence = row[2] if row[2] is not None else 0.5

                        # Intra-group relation → skip
                        if other_id in absorbed_set:
                            deleted += 1
                            continue

                        # Self-loop to new entity → skip
                        if other_id == new_entity_id:
                            deleted += 1
                            continue

                        # Deduplicate: check if new entity already has this edge
                        existing = conn.execute(
                            f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                            f"WHERE a.id = $nid AND b.id = $oid "
                            f"RETURN count(r)",
                            {"nid": new_entity_id, "oid": other_id},
                        )
                        if existing.has_next() and existing.get_next()[0] > 0:
                            deleted += 1
                            continue

                        conn.execute(
                            f"MATCH (a:Entity {{id: $nid}}), (b:Entity {{id: $oid}}) "
                            f"CREATE (a)-[r:REL_{rel_type}]->(b) "
                            f"SET r.weight = $w, r.confidence = $c",
                            {"nid": new_entity_id, "oid": other_id, "w": weight, "c": confidence},
                        )
                        migrated += 1

                # Collect all incoming edges to absorbed entities
                for absorbed_id in absorbed_ids:
                    result = conn.execute(
                        f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                        f"WHERE b.id = $aid "
                        f"RETURN a.id, r.weight, r.confidence",
                        {"aid": absorbed_id},
                    )
                    rows = []
                    while result.has_next():
                        rows.append(result.get_next())

                    for row in rows:
                        other_id = row[0]
                        weight = row[1] if row[1] is not None else 1.0
                        confidence = row[2] if row[2] is not None else 0.5

                        # Intra-group relation → skip
                        if other_id in absorbed_set:
                            deleted += 1
                            continue

                        # Self-loop to new entity → skip
                        if other_id == new_entity_id:
                            deleted += 1
                            continue

                        # Deduplicate: check if new entity already has this edge
                        existing = conn.execute(
                            f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                            f"WHERE a.id = $oid AND b.id = $nid "
                            f"RETURN count(r)",
                            {"nid": new_entity_id, "oid": other_id},
                        )
                        if existing.has_next() and existing.get_next()[0] > 0:
                            deleted += 1
                            continue

                        conn.execute(
                            f"MATCH (a:Entity {{id: $oid}}), (b:Entity {{id: $nid}}) "
                            f"CREATE (a)-[r:REL_{rel_type}]->(b) "
                            f"SET r.weight = $w, r.confidence = $c",
                            {"nid": new_entity_id, "oid": other_id, "w": weight, "c": confidence},
                        )
                        migrated += 1

                # Delete all edges involving absorbed entities
                for absorbed_id in absorbed_ids:
                    conn.execute(
                        f"MATCH (a:Entity)-[r:REL_{rel_type}]->(b:Entity) "
                        f"WHERE a.id = $aid OR b.id = $aid DELETE r",
                        {"aid": absorbed_id},
                    )

            # Delete all absorbed entities
            for absorbed_id in absorbed_ids:
                conn.execute(
                    "MATCH (e:Entity {id: $id}) DELETE e",
                    {"id": absorbed_id},
                )

            return {"relations_migrated": migrated, "relations_deleted": deleted}

        async with self._write_lock:
            result = await self._run_sync(_exec)
        self.invalidate_adj_cache()
        return result

    # ── Internal Helpers ───────────────────────────────────

    _LEGACY_TYPE_MAP = {
        "abstract_principle": "rule",
        "concrete_case": "event",
        "problem_prototype": "issue",
        "problem_archetype": "issue",
        "concept": "concept",
        "problem": "issue",
        "method": "activity",
        "principle": "rule",
        "case": "event",
        "boundary": "rule",
    }

    def _collect_entities(self, result) -> List[Entity]:
        entities = []
        col_names = result.get_column_names()
        while result.has_next():
            row = result.get_next()
            entities.append(self._row_to_entity(row, col_names))
        return entities

    def _row_to_entity(self, row, col_names: List[str]) -> Entity:
        data = {}
        for i, col in enumerate(col_names):
            key = col.split(".")[-1] if "." in col else col
            data[key] = row[i] if i < len(row) else None

        sources_raw = data.get("sources", "[]")
        if isinstance(sources_raw, str):
            sources_data = json.loads(sources_raw)
        else:
            sources_data = sources_raw or []
        sources = [EntitySource(**s) for s in sources_data] if sources_data else []

        raw_type = data.get("entity_type", "concept")
        try:
            entity_type = EntityType(raw_type)
        except ValueError:
            mapped = self._LEGACY_TYPE_MAP.get(raw_type, "concept")
            entity_type = EntityType(mapped)

        label = data.get("label") or ""
        summary = data.get("summary") or ""

        return Entity(
            id=data.get("id", ""),
            label=label,
            summary=summary,
            entity_type=entity_type,
            subtype=data.get("subtype") or None,
            confidence=data.get("confidence", 0.5),
            sources=sources,
        )

    def _dict_to_entity(self, data: dict) -> Entity:
        sources_raw = data.get("sources", "[]")
        if isinstance(sources_raw, str):
            sources_data = json.loads(sources_raw)
        else:
            sources_data = sources_raw or []
        sources = [EntitySource(**s) for s in sources_data] if sources_data else []

        raw_type = data.get("entity_type", "concept")
        try:
            entity_type = EntityType(raw_type)
        except ValueError:
            mapped = self._LEGACY_TYPE_MAP.get(raw_type, "concept")
            entity_type = EntityType(mapped)

        label = data.get("label") or ""
        summary = data.get("summary") or ""

        return Entity(
            id=data.get("id", ""),
            label=label,
            summary=summary,
            entity_type=entity_type,
            subtype=data.get("subtype") or None,
            confidence=data.get("confidence", 0.5),
            sources=sources,
        )
