from __future__ import annotations

from functools import lru_cache
from typing import Optional

from fastapi import Header, HTTPException

from config.settings import settings
from src.agents.evaluation_agent import EvaluationAgent
from src.agents.feynman_agent import FeynmanAgent
from src.agents.merge_agent import MergeAgent
from src.agents.retrieval_agent import RetrievalAgent
from src.llm.base import BaseLLM
from src.llm.openai_llm import OpenAILLM
from src.llm.anthropic_llm import AnthropicLLM
from src.services import auth_service
from src.services.knowledge_service import KnowledgeService
from src.services.search_service import SearchService
from src.storage.entity_search import EntitySearchStore
from src.storage.kuzu_store import KuzuStore


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency that extracts and validates the current user from the Authorization header.

    Returns the user dict (with 'id', 'username', 'permissions', etc.).
    Raises HTTPException 401 if the token is missing or invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = authorization.split(" ", 1)[1]
    payload = auth_service.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    user_id = int(payload["sub"])
    user = auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


@lru_cache()
def get_graph_store() -> KuzuStore:
    return KuzuStore(settings.KUZU_DB_PATH)


@lru_cache()
def get_llm() -> BaseLLM:
    if settings.LLM_PROVIDER == "anthropic":
        return AnthropicLLM(settings.ANTHROPIC_API_KEY, settings.ANTHROPIC_MODEL)
    return OpenAILLM(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_MODEL,
        base_url=settings.OPENAI_BASE_URL,
        max_tokens=settings.OPENAI_MAX_TOKENS,
    )


@lru_cache()
def get_entity_search() -> EntitySearchStore:
    return EntitySearchStore()


def get_knowledge_service() -> KnowledgeService:
    graph = get_graph_store()
    llm = get_llm()
    entity_search = get_entity_search()

    return KnowledgeService(
        feynman=FeynmanAgent(llm, graph),
        retrieval=RetrievalAgent(llm, graph, entity_search=entity_search),
        evaluator=EvaluationAgent(llm),
        entity_search=entity_search,
    )


def get_search_service() -> SearchService:
    return SearchService(get_graph_store(), get_entity_search())


def get_merge_agent() -> MergeAgent:
    return MergeAgent(llm=get_llm(), graph_store=get_graph_store(), entity_search=get_entity_search())
