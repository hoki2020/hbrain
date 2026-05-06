from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional


class BaseLLM(ABC):
    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> str:
        ...

    @abstractmethod
    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> dict:
        ...


class BaseEmbedder(ABC):
    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        ...

    @abstractmethod
    async def embed_single(self, text: str) -> List[float]:
        ...
