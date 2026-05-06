from __future__ import annotations

import io
import logging
from typing import Optional

from minio import Minio
from minio.error import S3Error

from config.settings import settings

logger = logging.getLogger(__name__)

_client: Optional[Minio] = None


def get_minio() -> Minio:
    """Singleton client — use only for one-time checks (bucket_exists, make_bucket).
    All read/write operations must use _new_client() to avoid connection pool contention."""
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _client


def ensure_bucket(bucket_name: str | None = None) -> None:
    bucket = bucket_name or settings.MINIO_BUCKET
    client = get_minio()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
        logger.info(f"Created MinIO bucket: {bucket}")


def get_public_url(object_name: str, bucket_name: str | None = None) -> str:
    """Generate a URL for accessing a MinIO object via backend proxy."""
    return f"{settings.API_BASE_URL}/api/knowledge/proxy-image/{object_name}"


def upload_file(
    object_name: str,
    file_data: bytes,
    content_type: str = "application/octet-stream",
    bucket_name: str | None = None,
) -> str:
    bucket = bucket_name or settings.MINIO_BUCKET
    ensure_bucket(bucket)
    client = _new_client()
    client.put_object(
        bucket,
        object_name,
        io.BytesIO(file_data),
        length=len(file_data),
        content_type=content_type,
    )
    return f"{bucket}/{object_name}"


def _new_client() -> Minio:
    """Create a fresh MinIO client (each call gets its own connection pool)."""
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


def download_file(object_name: str, bucket_name: str | None = None, retries: int = 3) -> bytes:
    """Download a file from MinIO. Uses a fresh client per call to avoid connection pool contention."""
    bucket = bucket_name or settings.MINIO_BUCKET
    last_err = None
    for attempt in range(retries):
        client = _new_client()
        try:
            response = client.get_object(bucket, object_name)
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()
        except Exception as e:
            last_err = e
            logger.warning(f"download_file attempt {attempt + 1}/{retries} failed for {object_name}: {e}")
    raise last_err


def delete_file(object_name: str, bucket_name: str | None = None) -> bool:
    bucket = bucket_name or settings.MINIO_BUCKET
    client = _new_client()
    try:
        client.remove_object(bucket, object_name)
        return True
    except S3Error:
        logger.warning(f"Failed to delete MinIO object: {object_name}")
        return False
