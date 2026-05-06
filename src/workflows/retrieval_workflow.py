from __future__ import annotations

from typing import Any, Callable, Dict, Optional, TypedDict

from langgraph.graph import END, StateGraph

from src.agents.retrieval_agent import RetrievalAgent
from src.models.graph import ActivationResult


class RetrievalState(TypedDict):
    query: str
    doc_search_fn: Optional[Callable]
    max_depth: int
    result: ActivationResult | None


def build_retrieval_workflow(retrieval: RetrievalAgent) -> Any:
    graph = StateGraph(RetrievalState)

    async def retrieve_step(state: RetrievalState) -> Dict:
        result = await retrieval.retrieve(
            state["query"],
            doc_search_fn=state.get("doc_search_fn"),
            max_depth=state.get("max_depth", 2),
        )
        return {"result": result}

    graph.add_node("retrieve", retrieve_step)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", END)

    return graph.compile()
