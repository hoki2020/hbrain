from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional, Tuple

from src.models.entity import Entity
from src.models.graph import SubGraph
from src.models.relation import Relation, RelationType


class GraphStore(ABC):
    """Abstract interface for graph database operations."""

    @abstractmethod
    async def create_entity(self, entity: Entity) -> str:
        ...

    @abstractmethod
    async def get_entity(self, entity_id: str) -> Optional[Entity]:
        ...

    @abstractmethod
    async def update_entity(self, entity: Entity) -> None:
        ...

    @abstractmethod
    async def delete_entity(self, entity_id: str) -> None:
        ...

    @abstractmethod
    async def delete_all(self) -> None:
        """Delete ALL entities and relations from the graph."""
        ...

    @abstractmethod
    async def delete_by_doc(self, doc_id: int) -> Tuple[int, List[str], List[str]]:
        """Remove entities/relations extracted from *doc_id*.

        - Entities whose **only** source is *doc_id* are deleted (along with
          all their relations).
        - Entities that also have sources from other documents keep those
          sources; only the *doc_id* entry is removed.

        Returns (deleted_count, deleted_entity_ids, updated_entity_ids).
        """
        ...

    @abstractmethod
    async def create_relation(self, relation: Relation) -> None:
        ...

    @abstractmethod
    async def get_neighbors(
        self,
        entity_id: str,
        relation_types: Optional[List[RelationType]] = None,
        direction: str = "both",
        max_depth: int = 1,
    ) -> SubGraph:
        ...

    @abstractmethod
    async def find_by_type(self, entity_type: str, limit: int = 100) -> List[Entity]:
        ...

    @abstractmethod
    async def find_path(
        self, source_id: str, target_id: str, max_depth: int = 5
    ) -> Optional[List[str]]:
        ...

    @abstractmethod
    async def get_related(
        self, entity_id: str, relation_type: RelationType, direction: str = "outgoing"
    ) -> List[Entity]:
        ...

    @abstractmethod
    async def get_all_entities(self, limit: int = 500) -> List[Entity]:
        ...

    @abstractmethod
    async def get_entities_by_ids(self, entity_ids: List[str]) -> List[Entity]:
        """Batch fetch entities by their IDs."""
        ...

    @abstractmethod
    async def get_all_relations(self, limit: int = 1000) -> List[Relation]:
        ...

    @abstractmethod
    async def get_entity_count(self) -> int:
        ...

    @abstractmethod
    async def get_relation_count(self) -> int:
        ...

    @abstractmethod
    async def get_entity_relations(self, entity_id: str) -> List[dict]:
        """Get all relations involving an entity (for merge preview).

        Returns list of dicts with keys: from_id, to_id, rel_type, weight, confidence, direction.
        """
        ...

    @abstractmethod
    async def merge_entity_group(self, new_entity_id: str, absorbed_ids: List[str]) -> dict:
        """Migrate relations from multiple absorbed entities to a new entity, then delete them.

        - Skips intra-group relations (both endpoints in absorbed_ids).
        - Skips self-loops (endpoint == new_entity_id).
        - Deduplicates parallel edges (same rel_type + same target).

        Returns dict with keys: relations_migrated, relations_deleted.
        """
        ...


class DocumentStore(ABC):
    """Abstract interface for file-based document storage."""

    @abstractmethod
    async def save_source(
        self, entity_id: str, content: str, metadata: dict
    ) -> str:
        ...

    @abstractmethod
    async def load_source(self, path: str) -> str:
        ...

    @abstractmethod
    async def export_graph(self, data: dict, filename: str) -> str:
        ...

    @abstractmethod
    async def import_source(self, filepath: str) -> str:
        ...
