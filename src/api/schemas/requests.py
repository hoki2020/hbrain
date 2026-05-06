from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    text: str
    doc_id: Optional[int] = None
    doc_name: Optional[str] = None


class QueryRequest(BaseModel):
    question: str
    max_depth: int = Field(default=2, ge=1, le=5)
