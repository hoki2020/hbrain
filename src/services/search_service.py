from __future__ import annotations

from typing import List, Optional

from src.models.entity import Entity
from src.models.relation import RelationType
from src.storage.interfaces import GraphStore


class SearchService:
    def __init__(self, graph_store: GraphStore, entity_search=None):
        self._graph = graph_store
        self._entity_search = entity_search

    async def search_entities(self, query: str, limit: int = 20) -> List[Entity]:
        return await self._entity_search.search_entities(query, self._graph, limit=limit)

    async def get_entity_neighbors(
        self,
        entity_id: str,
        relation_type: Optional[RelationType] = None,
        direction: str = "both",
    ) -> List[Entity]:
        return await self._graph.get_related(
            entity_id, relation_type, direction=direction
        ) if relation_type else []

    async def get_full_graph(self) -> dict:
        entities = await self._graph.get_all_entities(limit=500)
        relations = await self._graph.get_all_relations(limit=1000)
        return {
            "entities": [e.model_dump(mode="json") for e in entities],
            "relations": [r.model_dump(mode="json") for r in relations],
        }
