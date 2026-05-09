from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class EntityType(str, Enum):
    DOCUMENT = "document"       # 文档
    AGENT = "agent"             # 主体
    OBJECT = "object"           # 对象
    CONCEPT = "concept"         # 概念
    EVENT = "event"             # 事件
    ACTIVITY = "activity"       # 活动
    RULE = "rule"               # 规则
    METRIC = "metric"           # 指标
    TIME = "time"               # 时间
    LOCATION = "location"       # 地点
    STATEMENT = "statement"     # 陈述
    ISSUE = "issue"             # 问题
    IMAGE = "image"             # 图片


class EntitySource(BaseModel):
    doc_id: Optional[int] = None
    doc_name: Optional[str] = None
    excerpt: str
    chunk_index: Optional[int] = None
    heading_path: Optional[str] = None
    offset: Optional[int] = None
    added_at: datetime = Field(default_factory=datetime.utcnow)


class Entity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    label: str
    summary: str
    entity_type: EntityType
    subtype: Optional[str] = None
    sources: List[EntitySource] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
