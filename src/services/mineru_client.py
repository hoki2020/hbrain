from __future__ import annotations

import io
import json
import logging
import time
import zipfile

import httpx
import requests as _requests

from config.settings import settings

logger = logging.getLogger(__name__)

API_BASE = settings.MINERU_API_BASE
TOKEN = settings.MINERU_API_TOKEN
MODEL = settings.MINERU_MODEL

SUPPORTED_FORMATS = {"pdf", "png", "jpg", "jpeg", "jp2", "webp", "gif", "bmp",
                     "docx", "pptx", "doc", "ppt", "html"}


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}",
    }


# ── File upload flow (no public URL needed) ──────────────


def _get_upload_urls(filenames: list[str]) -> tuple[str, list[str]]:
    """Request upload URLs from MinerU batch API. Returns (batch_id, upload_urls)."""
    files_payload = [{"name": name} for name in filenames]
    resp = httpx.post(
        f"{API_BASE}/file-urls/batch",
        headers=_headers(),
        json={
            "files": files_payload,
            "model_version": MODEL,
            "enable_formula": True,
            "enable_table": True,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"MinerU upload URL error: {data.get('msg', 'unknown')} (code={data.get('code')})")
    batch_id = data["data"]["batch_id"]
    upload_urls = data["data"]["file_urls"]
    logger.info(f"MinerU batch created: {batch_id}, {len(upload_urls)} file(s)")
    return batch_id, upload_urls


def _upload_file(upload_url: str, file_data: bytes) -> None:
    """PUT file bytes to MinerU's presigned upload URL (no Content-Type)."""
    resp = _requests.put(upload_url, data=file_data)
    resp.raise_for_status()
    logger.info(f"File uploaded to MinerU ({len(file_data)} bytes)")


def _poll_batch(batch_id: str, timeout: int = 600, interval: int = 5) -> dict:
    """Poll batch result until done. Returns the first extract_result."""
    start = time.time()
    while time.time() - start < timeout:
        resp = httpx.get(
            f"{API_BASE}/extract-results/batch/{batch_id}",
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"MinerU batch poll error: {data.get('msg')}")

        extract_results = data["data"].get("extract_result", [])
        if extract_results:
            first = extract_results[0]
            state = first.get("state", "")
            logger.info(f"MinerU batch {batch_id}: state={state}")
            if state == "done":
                return first
            elif state == "failed":
                raise RuntimeError(f"MinerU parsing failed: {first.get('err_msg', 'unknown')}")

        time.sleep(interval)

    raise TimeoutError(f"MinerU batch {batch_id} timed out after {timeout}s")


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def _download_markdown(zip_url: str) -> tuple[str, dict[str, bytes]]:
    """Download the result ZIP. Returns (markdown, images) where images = {relative_path: bytes}."""
    resp = httpx.get(zip_url, timeout=120)
    resp.raise_for_status()

    images: dict[str, bytes] = {}
    markdown: str | None = None

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        # Extract images
        for name in zf.namelist():
            ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
            if ext in _IMAGE_EXTS and not name.startswith("__MACOSX"):
                images[name] = zf.read(name)

        # Extract markdown
        for name in zf.namelist():
            if name.endswith("full.md"):
                markdown = zf.read(name).decode("utf-8")
                break

        if markdown is None:
            for name in zf.namelist():
                if name.endswith(".md"):
                    markdown = zf.read(name).decode("utf-8")
                    break

        if markdown is None:
            for name in zf.namelist():
                if name.endswith(".json"):
                    try:
                        json_data = json.loads(zf.read(name))
                        if "content_list" in json_data:
                            texts = []
                            for item in json_data["content_list"]:
                                if item.get("text"):
                                    texts.append(item["text"])
                            if texts:
                                markdown = "\n\n".join(texts)
                                break
                    except (json.JSONDecodeError, KeyError):
                        continue

    if markdown is None:
        raise RuntimeError("No markdown content found in MinerU result ZIP")

    logger.info(f"MinerU ZIP: markdown={len(markdown)} chars, {len(images)} images")
    return markdown, images


def parse_and_get_markdown(file_data: bytes, filename: str, language: str = "ch") -> tuple[str, dict[str, bytes]]:
    """Full pipeline: upload file → poll → download markdown + images.

    Args:
        file_data: raw bytes of the file to parse
        filename: original filename (used by MinerU to detect format)

    Returns:
        (markdown, images) where images = {relative_path: bytes}
    """
    batch_id, upload_urls = _get_upload_urls([filename])
    if not upload_urls:
        raise RuntimeError("MinerU returned no upload URL")

    _upload_file(upload_urls[0], file_data)
    result = _poll_batch(batch_id)
    zip_url = result.get("full_zip_url", "")
    if not zip_url:
        raise RuntimeError("MinerU returned no result URL")
    return _download_markdown(zip_url)


# ── Legacy URL-based flow (kept for reference) ───────────


def parse_document_url(file_url: str, language: str = "ch") -> str:
    """Submit a document URL for parsing. Returns task_id."""
    resp = httpx.post(
        f"{API_BASE}/extract/task",
        headers=_headers(),
        json={
            "url": file_url,
            "model_version": MODEL,
            "enable_formula": True,
            "enable_table": True,
            "language": language,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"MinerU API error: {data.get('msg', 'unknown')} (code={data.get('code')})")
    task_id = data["data"]["task_id"]
    logger.info(f"MinerU task created: {task_id}")
    return task_id


def poll_result(task_id: str, timeout: int = 600, interval: int = 5) -> dict:
    """Poll until task is done. Returns {state, full_zip_url, err_msg}."""
    start = time.time()
    while time.time() - start < timeout:
        resp = httpx.get(
            f"{API_BASE}/extract/task/{task_id}",
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"MinerU poll error: {data.get('msg')}")

        state = data["data"]["state"]
        logger.info(f"MinerU task {task_id}: state={state}")

        if state == "done":
            return data["data"]
        elif state == "failed":
            err_msg = data["data"].get("err_msg", "unknown error")
            raise RuntimeError(f"MinerU parsing failed: {err_msg}")

        time.sleep(interval)

    raise TimeoutError(f"MinerU task {task_id} timed out after {timeout}s")
