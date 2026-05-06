from __future__ import annotations

from typing import List

from src.llm.base import BaseEmbedder
from src.llm.openai_llm import OpenAIEmbedder


class LocalEmbedder(BaseEmbedder):
    def __init__(self, model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"):
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name)

    async def embed(self, texts: List[str]) -> List[List[float]]:
        embeddings = self._model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()

    async def embed_single(self, text: str) -> List[float]:
        embedding = self._model.encode([text], convert_to_numpy=True)
        return embedding[0].tolist()


def create_embedder(provider: str, **kwargs) -> BaseEmbedder:
    if provider == "openai":
        return OpenAIEmbedder(
            api_key=kwargs.get("api_key", ""),
            model=kwargs.get("model", "text-embedding-3-small"),
            base_url=kwargs.get("base_url", "https://api.openai.com/v1"),
        )
    elif provider == "local":
        return LocalEmbedder(
            model_name=kwargs.get(
                "model_name", "paraphrase-multilingual-MiniLM-L12-v2"
            )
        )
    else:
        raise ValueError(f"Unknown embedding provider: {provider}")
