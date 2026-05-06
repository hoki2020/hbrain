from __future__ import annotations

import json
from typing import List

from openai import AsyncOpenAI
from httpx import Timeout
from tenacity import retry, stop_after_attempt, wait_exponential

from src.llm.base import BaseEmbedder, BaseLLM


class OpenAILLM(BaseLLM):
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: str = "https://api.openai.com/v1",
    ):
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=Timeout(120.0))
        self._model = model

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> dict:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)


class OpenAIEmbedder(BaseEmbedder):
    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
        base_url: str = "https://api.openai.com/v1",
    ):
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def embed(self, texts: List[str]) -> List[List[float]]:
        response = await self._client.embeddings.create(
            model=self._model, input=texts
        )
        return [item.embedding for item in response.data]

    async def embed_single(self, text: str) -> List[float]:
        results = await self.embed([text])
        return results[0]
