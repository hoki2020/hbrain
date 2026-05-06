from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, StateGraph

from src.agents.feynman_agent import FeynmanAgent
from src.models.entity import Entity
from src.models.relation import Relation


class IngestState(TypedDict):
    text: str
    doc_id: Optional[int]
    doc_name: Optional[str]
    entities: List[Entity]
    relations: List[Relation]
    errors: List[str]


def build_ingest_workflow(feynman: FeynmanAgent) -> Any:
    graph = StateGraph(IngestState)

    async def extract_entities(state: IngestState) -> Dict:
        try:
            entities, relations = await feynman.extract(
                state["text"],
                doc_id=state.get("doc_id"),
                doc_name=state.get("doc_name"),
            )
            return {"entities": entities, "relations": relations}
        except Exception as e:
            return {"errors": [f"Extraction failed: {e}"]}

    graph.add_node("extract", extract_entities)
    graph.set_entry_point("extract")
    graph.add_edge("extract", END)

    return graph.compile()
