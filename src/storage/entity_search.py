from __future__ import annotations

import logging
import os
import re
import sqlite3
from typing import List, Optional

logger = logging.getLogger(__name__)

# Term type constants
TERM_LABEL = "label"
TERM_SUMMARY = "summary"
TERM_SOURCE_TITLE = "source_title"

# Scoring weights
SCORE_WEIGHTS = {
    TERM_LABEL: 100,
    TERM_SOURCE_TITLE: 50,
    TERM_SUMMARY: 30,
}


class EntitySearchStore:
    """SQLite FTS5-based entity search index.

    Stores pre-tokenized terms extracted from entity labels, summaries,
    and source document titles. Uses FTS5 for fast full-text matching.
    """

    def __init__(self, db_path: str = "./data/entity_search.db"):
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self._db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_conn()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS entity_search_terms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity_id TEXT NOT NULL,
                    canonical_entity_id TEXT NOT NULL,
                    term TEXT NOT NULL,
                    term_type TEXT NOT NULL,
                    weight REAL NOT NULL DEFAULT 1.0
                );

                CREATE INDEX IF NOT EXISTS idx_est_entity_id
                    ON entity_search_terms(entity_id);
                CREATE INDEX IF NOT EXISTS idx_est_canonical
                    ON entity_search_terms(canonical_entity_id);
                CREATE INDEX IF NOT EXISTS idx_est_type
                    ON entity_search_terms(term_type);

                CREATE VIRTUAL TABLE IF NOT EXISTS entity_search_fts USING fts5(
                    term,
                    content='entity_search_terms',
                    content_rowid='id'
                );
            """)

            # Create triggers for FTS sync (ignore if already exist)
            for trigger_sql in [
                """CREATE TRIGGER IF NOT EXISTS entity_search_ai
                   AFTER INSERT ON entity_search_terms BEGIN
                       INSERT INTO entity_search_fts(rowid, term)
                       VALUES (new.id, new.term);
                   END""",
                """CREATE TRIGGER IF NOT EXISTS entity_search_ad
                   AFTER DELETE ON entity_search_terms BEGIN
                       INSERT INTO entity_search_fts(entity_search_fts, rowid, term)
                       VALUES ('delete', old.id, old.term);
                   END""",
                """CREATE TRIGGER IF NOT EXISTS entity_search_au
                   AFTER UPDATE ON entity_search_terms BEGIN
                       INSERT INTO entity_search_fts(entity_search_fts, rowid, term)
                       VALUES ('delete', old.id, old.term);
                       INSERT INTO entity_search_fts(rowid, term)
                       VALUES (new.id, new.term);
                   END""",
            ]:
                try:
                    conn.execute(trigger_sql)
                except sqlite3.OperationalError:
                    pass  # trigger already exists

            conn.commit()
        finally:
            conn.close()

    def populate_terms(self, entity) -> None:
        """Index an entity's label, summary, and source doc names.

        Args:
            entity: Entity model instance with id, label, summary, sources.
        """
        conn = self._get_conn()
        try:
            eid = entity.id
            canonical = eid

            # Label term
            label = (entity.label or "").strip()
            if label:
                conn.execute(
                    "INSERT INTO entity_search_terms "
                    "(entity_id, canonical_entity_id, term, term_type, weight) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (eid, canonical, label, TERM_LABEL, 1.0),
                )

            # Summary term
            summary = (entity.summary or "").strip()
            if summary:
                conn.execute(
                    "INSERT INTO entity_search_terms "
                    "(entity_id, canonical_entity_id, term, term_type, weight) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (eid, canonical, summary, TERM_SUMMARY, 1.0),
                )

            # Source document title terms
            for src in (entity.sources or []):
                doc_name = (src.doc_name or "").strip()
                if doc_name:
                    conn.execute(
                        "INSERT INTO entity_search_terms "
                        "(entity_id, canonical_entity_id, term, term_type, weight) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (eid, canonical, doc_name, TERM_SOURCE_TITLE, 1.0),
                    )

            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def clear_entity(self, entity_id: str) -> None:
        """Remove all search terms for an entity."""
        conn = self._get_conn()
        try:
            conn.execute(
                "DELETE FROM entity_search_terms WHERE entity_id = ?",
                (entity_id,),
            )
            conn.commit()
        finally:
            conn.close()

    def clear_by_doc(self, doc_id: int) -> int:
        """Remove source_title terms for a specific document.

        Returns the number of rows deleted.
        """
        conn = self._get_conn()
        try:
            # We match by doc_name containing the doc_id pattern
            # This is a best-effort cleanup; exact matching requires
            # storing doc_id in the terms table.
            # For now, we rely on clear_entity being called for deleted entities.
            cursor = conn.execute(
                "DELETE FROM entity_search_terms "
                "WHERE term_type = ? AND term LIKE ?",
                (TERM_SOURCE_TITLE, f"%{doc_id}%"),
            )
            conn.commit()
            return cursor.rowcount
        finally:
            conn.close()

    def _is_cjk(self, text: str) -> bool:
        """Check if text contains CJK characters."""
        for ch in text:
            cp = ord(ch)
            if (0x4E00 <= cp <= 0x9FFF or    # CJK Unified Ideographs
                0x3400 <= cp <= 0x4DBF or    # CJK Extension A
                0xF900 <= cp <= 0xFAFF or    # CJK Compatibility
                0x2E80 <= cp <= 0x2EFF or    # CJK Radicals
                0x3000 <= cp <= 0x303F):     # CJK Symbols
                return True
        return False

    def _tokenize(self, text: str) -> List[str]:
        """Split query text into searchable tokens."""
        # Split on whitespace and CJK punctuation
        tokens = re.split(r'[\s，。、；：！？\(\)\[\]\{\}\"\'…—\-,.:;!?\[\]{}()]+', text)
        return [t.strip() for t in tokens if t.strip()]

    def search(self, query: str, limit: int = 10) -> List[dict]:
        """Search entities by query text using FTS5.

        Returns list of {entity_id, canonical_entity_id, score} sorted by score desc.
        Scoring: 100*label + 50*source_title + 30*summary

        For CJK queries, uses per-character FTS5 matching + LIKE confirmation
        because FTS5's default tokenizer splits CJK text into individual characters.
        """
        tokens = self._tokenize(query)
        if not tokens:
            logger.info(f"[FTS5] 查询 '{query}' → 分词为空，跳过搜索")
            return []

        logger.info(f"[FTS5] 查询 '{query}' → 分词: {tokens}")
        conn = self._get_conn()
        try:
            scores: dict[str, float] = {}
            match_details: dict[str, dict] = {}

            for token in tokens:
                is_cjk = self._is_cjk(token)

                if is_cjk and len(token) > 1:
                    # CJK multi-char: use LIKE to find terms containing the full query,
                    # then verify via FTS5 per-character matching for ranking.
                    # Step 1: Find candidate rows via LIKE (fast on entity_search_terms, not FTS5)
                    for term_type, weight in SCORE_WEIGHTS.items():
                        rows = conn.execute(
                            "SELECT entity_id, canonical_entity_id "
                            "FROM entity_search_terms "
                            "WHERE term LIKE ? AND term_type = ? "
                            "LIMIT ?",
                            (f"%{token}%", term_type, limit * 3),
                        ).fetchall()

                        if rows:
                            logger.debug(f"[FTS5]   CJK token='{token}' type={term_type} LIKE → {len(rows)} 条匹配")

                        for row in rows:
                            eid = row["entity_id"]
                            canonical = row["canonical_entity_id"]

                            base_score = weight
                            scores[canonical] = scores.get(canonical, 0) + base_score

                            if canonical not in match_details:
                                match_details[canonical] = {"label": 0, "source_title": 0, "summary": 0}
                            match_details[canonical][term_type] += 1
                else:
                    # Non-CJK or single char: use FTS5 prefix matching
                    fts_query = f'"{token}"*'

                    for term_type, weight in SCORE_WEIGHTS.items():
                        rows = conn.execute(
                            "SELECT est.entity_id, est.canonical_entity_id "
                            "FROM entity_search_fts fts "
                            "JOIN entity_search_terms est ON fts.rowid = est.id "
                            "WHERE fts.term MATCH ? AND est.term_type = ? "
                            "ORDER BY rank "
                            "LIMIT ?",
                            (fts_query, term_type, limit * 3),
                        ).fetchall()

                        if rows:
                            logger.debug(f"[FTS5]   token='{token}' type={term_type} → {len(rows)} 条匹配")

                        for row in rows:
                            eid = row["entity_id"]
                            canonical = row["canonical_entity_id"]

                            base_score = weight
                            scores[canonical] = scores.get(canonical, 0) + base_score

                            if canonical not in match_details:
                                match_details[canonical] = {"label": 0, "source_title": 0, "summary": 0}
                            match_details[canonical][term_type] += 1

            if not scores:
                logger.info(f"[FTS5] 查询 '{query}' → 无匹配结果")
                return []

            # Sort by score descending
            results = [
                {"entity_id": cid, "canonical_entity_id": cid, "score": score}
                for cid, score in scores.items()
            ]
            results.sort(key=lambda x: x["score"], reverse=True)
            results = results[:limit]

            logger.info(f"[FTS5] 查询 '{query}' → {len(results)} 个实体:")
            for r in results:
                cid = r["canonical_entity_id"]
                detail = match_details.get(cid, {})
                logger.info(
                    f"[FTS5]   {cid} score={r['score']:.0f} "
                    f"(label×{detail.get('label',0)}, source×{detail.get('source_title',0)}, summary×{detail.get('summary',0)})"
                )

            return results
        finally:
            conn.close()

    async def search_entities(
        self, query: str, graph_store, limit: int = 10
    ) -> list:
        """Search and return full Entity objects from the graph store.

        Args:
            query: Search query text.
            graph_store: GraphStore instance to fetch entity details.
            limit: Maximum number of results.

        Returns:
            List of Entity objects sorted by search relevance.
        """
        results = self.search(query, limit=limit)
        if not results:
            return []

        entities = []
        missing = 0
        for r in results:
            entity = await graph_store.get_entity(r["canonical_entity_id"])
            if entity:
                entities.append(entity)
            else:
                missing += 1
                logger.warning(f"[FTS5] 实体 {r['canonical_entity_id']} 在索引中存在但图谱中已删除")

        if missing:
            logger.info(f"[FTS5] 查询 '{query}' → {len(entities)} 个有效实体, {missing} 个索引孤儿")
        return entities
