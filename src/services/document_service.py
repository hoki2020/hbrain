from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime
from typing import List, Optional

from config.settings import settings

logger = logging.getLogger(__name__)

DB_PATH = "./data/documents.db"
UPLOAD_DIR = settings.UPLOAD_DIR


def _get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_doc_db():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            format TEXT NOT NULL,
            size INTEGER NOT NULL,
            status TEXT DEFAULT 'uploading',
            progress INTEGER DEFAULT 0,
            content TEXT,
            summary TEXT,
            uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
            parsed_at TEXT,
            error_message TEXT,
            minio_key TEXT,
            parsed_minio_key TEXT,
            markdown_content TEXT
        )
    """)
    # Migrate existing DBs
    for col, typ in [
        ("summary", "TEXT"),
        ("minio_key", "TEXT"),
        ("parsed_minio_key", "TEXT"),
        ("markdown_content", "TEXT"),
        ("source_type", "TEXT DEFAULT 'file'"),
    ]:
        try:
            conn.execute(f"ALTER TABLE documents ADD COLUMN {col} {typ}")
        except Exception:
            pass
    conn.commit()
    conn.close()


def save_upload_file(file_content: bytes, original_name: str) -> tuple[dict, bytes]:
    """Save metadata to DB and return (doc_info, file_content) for background upload."""
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "txt"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{original_name.replace(' ', '_')}"

    conn = _get_conn()
    try:
        cursor = conn.execute(
            """INSERT INTO documents (filename, original_name, format, size, status, progress, minio_key)
               VALUES (?, ?, ?, ?, 'uploading', 0, NULL)""",
            (filename, original_name, ext, len(file_content)),
        )
        doc_id = cursor.lastrowid
        conn.commit()

        return {
            "id": str(doc_id),
            "filename": filename,
            "originalName": original_name,
            "format": ext,
            "size": len(file_content),
            "status": "uploading",
            "progress": 0,
            "uploadedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }, file_content
    finally:
        conn.close()


def save_text_content(title: str, content: str) -> dict:
    """Save a text snippet directly (no file upload). Returns doc_info."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_title = title.replace(' ', '_')[:100]
    filename = f"{timestamp}_{safe_title}"
    size = len(content.encode("utf-8"))

    conn = _get_conn()
    try:
        cursor = conn.execute(
            """INSERT INTO documents (filename, original_name, format, size, status, progress, content, source_type)
               VALUES (?, ?, 'text', ?, 'extracting', 0, ?, 'text')""",
            (filename, title, size, content),
        )
        doc_id = cursor.lastrowid
        conn.commit()

        return {
            "id": str(doc_id),
            "filename": filename,
            "originalName": title,
            "format": "text",
            "size": size,
            "status": "extracting",
            "progress": 0,
            "source_type": "text",
            "uploadedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
    finally:
        conn.close()


def upload_to_minio(doc_id: int, file_content: bytes) -> str:
    """Upload file directly to MinIO. Returns minio_key."""
    from src.storage.minio_client import ensure_bucket, get_minio
    from config.settings import settings

    conn = _get_conn()
    try:
        row = conn.execute("SELECT filename FROM documents WHERE id=?", (doc_id,)).fetchone()
        if not row:
            raise RuntimeError(f"Document {doc_id} not found")
        filename = row["filename"]
    finally:
        conn.close()

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    minio_key = f"uploads/{filename}"

    update_doc_status(doc_id, "uploading", 10)

    ensure_bucket(settings.MINIO_BUCKET)
    update_doc_status(doc_id, "uploading", 30)
    client = get_minio()
    client.put_object(
        settings.MINIO_BUCKET,
        minio_key,
        __import__("io").BytesIO(file_content),
        length=len(file_content),
        content_type=_mime_type(ext),
    )

    update_doc_status(doc_id, "uploading", 90)

    conn = _get_conn()
    try:
        conn.execute("UPDATE documents SET minio_key=? WHERE id=?", (minio_key, doc_id))
        conn.commit()
    finally:
        conn.close()

    update_doc_status(doc_id, "uploading", 100)
    logger.info(f"Uploaded to MinIO: {minio_key}")
    return minio_key


def _upload_doc_images(doc_id: int, images: dict[str, bytes]) -> dict[str, str]:
    """Upload extracted images to MinIO. Returns {relative_path: http_url}."""
    from src.storage.minio_client import upload_file, get_public_url

    url_map: dict[str, str] = {}
    for rel_path, img_bytes in images.items():
        # Normalize path separator
        norm_path = rel_path.replace("\\", "/")
        # Extract just the filename
        img_filename = norm_path.rsplit("/", 1)[-1] if "/" in norm_path else norm_path
        minio_key = f"parsed/{doc_id}/images/{img_filename}"
        ext = img_filename.rsplit(".", 1)[-1].lower() if "." in img_filename else "png"
        content_type = {
            "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "webp": "image/webp", "gif": "image/gif", "bmp": "image/bmp",
        }.get(ext, "application/octet-stream")
        try:
            upload_file(minio_key, img_bytes, content_type)
            url_map[rel_path] = get_public_url(minio_key)
            logger.info(f"Uploaded image to MinIO: {minio_key} ({len(img_bytes)} bytes)")
        except Exception as e:
            logger.warning(f"Failed to upload image {rel_path}: {e}")
    return url_map


def _replace_image_urls(markdown: str, url_map: dict[str, str]) -> str:
    """Replace relative image paths in markdown with HTTP URLs."""
    import re

    def _replace_match(m: re.Match) -> str:
        alt = m.group(1)
        path = m.group(2)
        # Try exact match first, then try just the filename
        url = url_map.get(path)
        if not url:
            fname = path.rsplit("/", 1)[-1] if "/" in path else path
            for rp, http_url in url_map.items():
                if rp.endswith(fname) or rp.rsplit("/", 1)[-1] == fname:
                    url = http_url
                    break
        if url:
            return f"![{alt}]({url})"
        return m.group(0)

    # Match ![alt](path) patterns
    return re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', _replace_match, markdown)


def parse_with_mineru(doc_id: int) -> str:
    """Parse document using MinerU VLM API. Returns markdown content with image URLs replaced."""
    from src.services.mineru_client import parse_and_get_markdown
    from src.storage.minio_client import download_file, upload_file

    conn = _get_conn()
    try:
        row = conn.execute("SELECT minio_key, filename, format FROM documents WHERE id=?", (doc_id,)).fetchone()
        if not row:
            raise RuntimeError(f"Document {doc_id} not found")
    finally:
        conn.close()

    minio_key = row["minio_key"]
    filename = row["filename"]

    # Read file bytes from MinIO or local disk
    if minio_key:
        file_data = download_file(minio_key)
    else:
        filepath = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(filepath):
            raise RuntimeError(f"File not found: {filepath}")
        with open(filepath, "rb") as f:
            file_data = f.read()

    # Upload file bytes directly to MinerU (no public URL needed)
    logger.info(f"Parsing document {doc_id} with MinerU: {filename} ({len(file_data)} bytes)")
    markdown, images = parse_and_get_markdown(file_data, filename)

    # Upload images to MinIO and replace URLs in markdown
    if images:
        url_map = _upload_doc_images(doc_id, images)
        markdown = _replace_image_urls(markdown, url_map)
        logger.info(f"Replaced {len(url_map)} image URLs in markdown for doc #{doc_id}")

    # Store parsed markdown in MinIO
    parsed_key = f"parsed/{doc_id}.md"
    try:
        upload_file(parsed_key, markdown.encode("utf-8"), "text/markdown")
    except Exception as e:
        logger.warning(f"Failed to store parsed markdown in MinIO: {e}")
        parsed_key = None

    # Store markdown in DB
    conn = _get_conn()
    try:
        conn.execute(
            "UPDATE documents SET markdown_content=?, parsed_minio_key=?, content=? WHERE id=?",
            (markdown, parsed_key, markdown, doc_id),
        )
        conn.commit()
    finally:
        conn.close()

    return markdown


def update_doc_status(
    doc_id: int,
    status: str,
    progress: int = 0,
    content: str | None = None,
    error_message: str | None = None,
):
    conn = _get_conn()
    try:
        if status == "completed":
            conn.execute(
                "UPDATE documents SET status=?, progress=100, content=?, markdown_content=?, parsed_at=datetime('now','localtime') WHERE id=?",
                (status, content, content, doc_id),
            )
        elif status == "failed":
            conn.execute(
                "UPDATE documents SET status=?, error_message=? WHERE id=?",
                (status, error_message, doc_id),
            )
        else:
            if error_message:
                conn.execute(
                    "UPDATE documents SET status=?, progress=?, error_message=? WHERE id=?",
                    (status, progress, error_message, doc_id),
                )
            else:
                conn.execute(
                    "UPDATE documents SET status=?, progress=?, error_message=NULL WHERE id=?",
                    (status, progress, doc_id),
                )
        conn.commit()
    finally:
        conn.close()


def list_documents() -> List[dict]:
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM documents ORDER BY uploaded_at DESC"
        ).fetchall()
        return [
            {
                "id": str(r["id"]),
                "filename": r["filename"],
                "originalName": r["original_name"],
                "format": r["format"],
                "size": r["size"],
                "status": r["status"],
                "progress": r["progress"] if r["status"] in ("uploading", "parsing", "extracting") else None,
                "uploadedAt": r["uploaded_at"],
                "parsedAt": r["parsed_at"],
                "errorMessage": r["error_message"],
                "summary": r["summary"],
                "source_type": r["source_type"] or "file",
            }
            for r in rows
        ]
    finally:
        conn.close()


def get_document(doc_id: int) -> Optional[dict]:
    conn = _get_conn()
    try:
        r = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        if not r:
            return None
        return {
            "id": str(r["id"]),
            "filename": r["filename"],
            "originalName": r["original_name"],
            "format": r["format"],
            "size": r["size"],
            "status": r["status"],
            "progress": r["progress"] if r["status"] in ("uploading", "parsing", "extracting") else None,
            "content": r["content"],
            "summary": r["summary"],
            "uploadedAt": r["uploaded_at"],
            "parsedAt": r["parsed_at"],
            "errorMessage": r["error_message"],
            "markdownContent": r["markdown_content"],
            "source_type": r["source_type"] or "file",
        }
    finally:
        conn.close()


def delete_document(doc_id: int) -> bool:
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT filename, minio_key, parsed_minio_key FROM documents WHERE id=?",
            (doc_id,),
        ).fetchone()
        if not row:
            return False

        # Delete from MinIO
        from src.storage.minio_client import delete_file
        if row["minio_key"]:
            ok = delete_file(row["minio_key"])
            if not ok:
                logger.warning(f"[文档#{doc_id}] MinIO 删除失败（可能已不存在）: {row['minio_key']}")
        if row["parsed_minio_key"]:
            ok = delete_file(row["parsed_minio_key"])
            if not ok:
                logger.warning(f"[文档#{doc_id}] MinIO 删除失败（可能已不存在）: {row['parsed_minio_key']}")

        # Delete local file (fallback)
        filepath = os.path.join(UPLOAD_DIR, row["filename"])
        if os.path.exists(filepath):
            os.remove(filepath)

        conn.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def update_doc_summary(doc_id: int, summary: str):
    conn = _get_conn()
    try:
        conn.execute("UPDATE documents SET summary=? WHERE id=?", (summary, doc_id))
        conn.commit()
    finally:
        conn.close()


def search_paragraphs(doc_id: int, keywords: str, context_chars: int = 200) -> List[str]:
    """Search for paragraphs in parsed markdown that contain any of the keywords."""
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT markdown_content, content FROM documents WHERE id=?",
            (doc_id,),
        ).fetchone()
        if not row:
            return []

        # Prefer markdown_content, fallback to content
        text = row["markdown_content"] or row["content"] or ""
        if not text:
            return []

        keyword_list = [k.strip().lower() for k in keywords.split(",") if k.strip()]
        paragraphs = []
        # Split by double newline (markdown paragraph boundary)
        for para in text.split("\n\n"):
            para = para.strip()
            if not para:
                continue
            para_lower = para.lower()
            if any(kw in para_lower for kw in keyword_list):
                paragraphs.append(para)
        return paragraphs[:10]
    finally:
        conn.close()


def _mime_type(ext: str) -> str:
    return {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls": "application/vnd.ms-excel",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "ppt": "application/vnd.ms-powerpoint",
        "txt": "text/plain",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
        "bmp": "image/bmp",
        "html": "text/html",
    }.get(ext, "application/octet-stream")


# Initialize DB on import
init_doc_db()
