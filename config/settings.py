from __future__ import annotations

from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Kuzu ---
    KUZU_DB_PATH: str = "./data/kuzu/hbrain.kuzu"

    # --- LLM ---
    LLM_PROVIDER: str = "openai"  # "openai" or "anthropic"
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    # --- Embedding (used by seed scripts) ---
    EMBEDDING_PROVIDER: str = "openai"  # "openai" or "local"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536
    LOCAL_EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"
    LOCAL_EMBEDDING_DIMENSION: int = 384

    # --- Retrieval ---
    DEFAULT_SEARCH_TOP_K: int = 10
    SUBGRAPH_MAX_DEPTH: int = 2

    # --- Auth ---
    JWT_SECRET: str = "hbrain-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # --- MinIO ---
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "hbrain"
    MINIO_SECURE: bool = False

    # --- MinerU ---
    MINERU_API_TOKEN: str = ""
    MINERU_API_BASE: str = "https://mineru.net/api/v4"
    MINERU_MODEL: str = "vlm"

    # --- Upload (legacy fallback) ---
    UPLOAD_DIR: str = "./data/uploads"

    # --- API ---
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_BASE_URL: str = "http://localhost:8000"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
