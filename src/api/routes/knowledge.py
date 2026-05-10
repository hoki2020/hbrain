from __future__ import annotations

import logging

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends
from pydantic import BaseModel, Field

from src.api.deps import get_current_user
from src.services import document_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

SUPPORTED_FORMATS = {
    "pdf", "png", "jpg", "jpeg", "jp2", "webp", "gif", "bmp",
    "docx", "doc", "pptx", "ppt", "xlsx", "xls", "html", "txt",
}

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_TEXT_SIZE = 1 * 1024 * 1024  # 1 MB


class TextSnippetRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    convert_to_wiki: bool = False


async def _process_document(doc_id: int, original_name: str, file_content: bytes):
    """Background task: upload to MinIO, parse with MinerU, then extract knowledge."""
    import time
    t0 = time.time()
    try:
        size_kb = len(file_content) / 1024
        ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
        logger.info(f"[文档处理] ── 开始处理 #{doc_id}: {original_name} ({size_kb:.1f} KB)")

        # Upload to MinIO
        logger.info(f"[文档处理] #{doc_id} Step1 上传到 MinIO...")
        document_service.update_doc_status(doc_id, "uploading", 0)
        document_service.upload_to_minio(doc_id, file_content)
        logger.info(f"[文档处理] #{doc_id} Step1 上传完成 ({time.time()-t0:.1f}s)")

        # Parse: txt files use content directly, others use MinerU
        if ext == "txt":
            logger.info(f"[文档处理] #{doc_id} Step2 txt 文件，跳过 MinerU 解析")
            document_service.update_doc_status(doc_id, "parsing", 0)
            markdown = file_content.decode("utf-8", errors="replace")
        else:
            logger.info(f"[文档处理] #{doc_id} Step2 开始 MinerU 解析...")
            document_service.update_doc_status(doc_id, "parsing", 0)
            t1 = time.time()
            markdown = document_service.parse_with_mineru(doc_id)
            logger.info(f"[文档处理] #{doc_id} Step2 MinerU 解析完成: markdown={len(markdown)} chars ({time.time()-t1:.1f}s)")

        document_service.update_doc_status(doc_id, "parsing", 60, content=markdown)

        # Generate document summary
        logger.info(f"[文档处理] #{doc_id} Step3 生成文档总结...")
        document_service.update_doc_status(doc_id, "parsing", 80)
        try:
            from src.api.deps import get_llm
            llm = get_llm()
            summary_prompt = f"用300字以内总结以下文档的核心内容：\n\n{markdown[:12000]}"
            t2 = time.time()
            summary = await llm.complete(
                "你是一个文档总结助手。用简洁的中文总结文档核心内容。",
                summary_prompt,
                max_tokens=500,
            )
            document_service.update_doc_summary(doc_id, summary)
            logger.info(f"[文档处理] #{doc_id} Step3 总结完成 ({time.time()-t2:.1f}s): {summary[:100]}...")
        except Exception as e:
            logger.warning(f"[文档处理] #{doc_id} Step3 总结生成失败: {e}")
        document_service.update_doc_status(doc_id, "parsing", 100)

        # Graph extraction
        logger.info(f"[文档处理] #{doc_id} Step4 开始图谱抽取...")
        document_service.update_doc_status(doc_id, "extracting", 0)
        from src.api.deps import get_knowledge_service
        svc = get_knowledge_service()

        def on_extract_progress(pct: int, msg: str):
            document_service.update_doc_status(doc_id, "extracting", pct)

        t3 = time.time()
        from config.settings import settings as _settings
        if len(markdown) > _settings.CHUNK_THRESHOLD:
            logger.info(f"[文档处理] #{doc_id} Step4 文档 {len(markdown)} chars > {_settings.CHUNK_THRESHOLD}，使用分chunk抽取")
            result = await svc.ingest_chunked(
                markdown, doc_id=doc_id, doc_name=original_name,
                on_progress=on_extract_progress,
            )
        else:
            result = await svc.ingest(
                markdown, doc_id=doc_id, doc_name=original_name,
                on_progress=on_extract_progress,
            )
        entity_count = len(result.entities)
        relation_count = len(result.relations)
        retries = result.retries
        logger.info(
            f"[文档处理] #{doc_id} Step4 图谱抽取完成 ({time.time()-t3:.1f}s): "
            f"{entity_count}个实体, {relation_count}个关系"
            f"{f', 重试{retries}次' if retries else ''}"
        )
        if result.evaluation_issues:
            for issue in result.evaluation_issues[:5]:
                logger.info(f"[文档处理] #{doc_id}   评估备注: {issue}")

        document_service.update_doc_status(doc_id, "completed", 100, content=markdown)
        logger.info(f"[文档处理] ── #{doc_id} 处理完成: {original_name} (总耗时 {time.time()-t0:.1f}s)")
    except Exception as e:
        err_msg = f"文档处理失败: {type(e).__name__}: {e}"
        logger.error(f"[文档处理] ── #{doc_id} 失败 ({time.time()-t0:.1f}s): {err_msg}")
        document_service.update_doc_status(doc_id, "failed", error_message=err_msg)


WIKI_CONVERSION_SYSTEM = (
    "你是一个文档结构化专家。将用户提供的原始文本转换为结构化的百科全书风格的Markdown文档。"
    "要求：\n"
    "1. 为内容添加清晰的标题和章节结构\n"
    "2. 将问答对、对话等内容提炼为独立的知识条目\n"
    "3. 使用Markdown标题(##)、列表、粗体等格式增强可读性\n"
    "4. 保留所有原始信息，不要遗漏任何关键内容\n"
    "5. 如果内容是问答格式，将每个问答转换为独立的条目，用##标题标注问题，正文给出回答"
)


async def _process_text_snippet(doc_id: int, title: str, text_content: str, convert_to_wiki: bool):
    """Background task: optionally convert to wiki, then extract knowledge from text."""
    import time
    t0 = time.time()
    try:
        logger.info(f"[文本处理] ── 开始处理 #{doc_id}: {title} ({len(text_content)} chars)")

        content = text_content

        # Step 1: Optionally convert to wiki format
        if convert_to_wiki:
            logger.info(f"[文本处理] #{doc_id} Step1 转换为百科格式...")
            document_service.update_doc_status(doc_id, "extracting", 5)
            try:
                from src.api.deps import get_llm
                llm = get_llm()
                t1 = time.time()
                content = await llm.complete(
                    WIKI_CONVERSION_SYSTEM,
                    f"请将以下文本转换为百科格式：\n\n{text_content}",
                    max_tokens=4096,
                )
                logger.info(f"[文本处理] #{doc_id} Step1 百科转换完成 ({time.time()-t1:.1f}s): {len(content)} chars")
                # Update the document content with wiki version
                conn = document_service._get_conn()
                try:
                    conn.execute("UPDATE documents SET content=?, markdown_content=? WHERE id=?",
                                 (content, content, doc_id))
                    conn.commit()
                finally:
                    conn.close()
            except Exception as e:
                logger.warning(f"[文本处理] #{doc_id} Step1 百科转换失败，使用原文: {e}")
                content = text_content

        document_service.update_doc_status(doc_id, "extracting", 10)

        # Step 2: Generate summary
        logger.info(f"[文本处理] #{doc_id} Step2 生成摘要...")
        try:
            from src.api.deps import get_llm
            llm = get_llm()
            summary_prompt = f"用300字以内总结以下内容的核心要点：\n\n{content[:12000]}"
            t2 = time.time()
            summary = await llm.complete(
                "你是一个内容总结助手。用简洁的中文总结核心内容。",
                summary_prompt,
                max_tokens=500,
            )
            document_service.update_doc_summary(doc_id, summary)
            logger.info(f"[文本处理] #{doc_id} Step2 摘要完成 ({time.time()-t2:.1f}s)")
        except Exception as e:
            logger.warning(f"[文本处理] #{doc_id} Step2 摘要生成失败: {e}")

        # Step 3: Graph extraction
        logger.info(f"[文本处理] #{doc_id} Step3 开始图谱抽取...")
        document_service.update_doc_status(doc_id, "extracting", 30)
        from src.api.deps import get_knowledge_service
        svc = get_knowledge_service()

        def on_extract_progress(pct: int, msg: str):
            document_service.update_doc_status(doc_id, "extracting", 30 + int(pct * 0.65))

        t3 = time.time()
        from config.settings import settings as _settings
        if len(content) > _settings.CHUNK_THRESHOLD:
            logger.info(f"[文本处理] #{doc_id} Step3 文本 {len(content)} chars > {_settings.CHUNK_THRESHOLD}，使用分chunk抽取")
            result = await svc.ingest_chunked(
                content, doc_id=doc_id, doc_name=title,
                on_progress=on_extract_progress,
            )
        else:
            result = await svc.ingest(
                content, doc_id=doc_id, doc_name=title,
                on_progress=on_extract_progress,
            )
        entity_count = len(result.entities)
        relation_count = len(result.relations)
        logger.info(
            f"[文本处理] #{doc_id} Step3 图谱抽取完成 ({time.time()-t3:.1f}s): "
            f"{entity_count}个实体, {relation_count}个关系"
        )

        document_service.update_doc_status(doc_id, "completed", 100, content=content)
        logger.info(f"[文本处理] ── #{doc_id} 处理完成: {title} (总耗时 {time.time()-t0:.1f}s)")
    except Exception as e:
        err_msg = f"文本处理失败: {type(e).__name__}: {e}"
        logger.error(f"[文本处理] ── #{doc_id} 失败 ({time.time()-t0:.1f}s): {err_msg}")
        document_service.update_doc_status(doc_id, "failed", error_message=err_msg)


@router.post("/text")
async def submit_text_snippet(
    req: TextSnippetRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Submit a text snippet for knowledge extraction (no file upload needed)."""
    # CJK chars are ~3 bytes in UTF-8, so chars * 3 is an upper bound
    if len(req.content) * 3 > MAX_TEXT_SIZE:
        return {"error": f"文本大小超过限制（最大 {MAX_TEXT_SIZE // 1024 // 1024}MB）"}

    doc_info = document_service.save_text_content(req.title, req.content)
    doc_id = int(doc_info["id"])

    background_tasks.add_task(
        _process_text_snippet,
        doc_id,
        req.title,
        req.content,
        req.convert_to_wiki,
    )

    return doc_info


@router.get("/documents")
async def list_documents(user: dict = Depends(get_current_user)):
    return document_service.list_documents()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    original_name = file.filename or "unknown.txt"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "txt"

    if ext not in SUPPORTED_FORMATS:
        return {"error": f"不支持的文件格式: .{ext}"}

    # Read in chunks to enforce size limit without loading entire file first
    chunks: list[bytes] = []
    total_size = 0
    while True:
        chunk = await file.read(1024 * 1024)  # 1MB chunks
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_UPLOAD_SIZE:
            return {"error": f"文件大小超过限制（最大 {MAX_UPLOAD_SIZE // 1024 // 1024}MB）"}
        chunks.append(chunk)
    content = b"".join(chunks)

    doc_info, file_content = document_service.save_upload_file(content, original_name)

    background_tasks.add_task(
        _process_document,
        int(doc_info["id"]),
        original_name,
        file_content,
    )

    return doc_info


@router.get("/documents/{doc_id}")
async def get_document(doc_id: int, user: dict = Depends(get_current_user)):
    doc = document_service.get_document(doc_id)
    if not doc:
        return {"error": "Document not found"}
    return doc


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: int, user: dict = Depends(get_current_user)):
    success = document_service.delete_document(doc_id)
    if not success:
        return {"success": False, "message": "文档不存在"}

    # Remove graph entities/relations extracted from this document
    try:
        from src.api.deps import get_graph_store, get_entity_search
        store = get_graph_store()
        deleted_count, deleted_ids, updated_ids = await store.delete_by_doc(doc_id)
        logger.info(f"[知识库] 清理文档 #{doc_id} 的图谱数据: 删除 {deleted_count} 个实体")

        # Clean up search index
        entity_search = get_entity_search()
        for eid in deleted_ids:
            entity_search.clear_entity(eid)
        for eid in updated_ids:
            entity_search.clear_entity(eid)
            entity = await store.get_entity(eid)
            if entity:
                entity_search.populate_terms(entity)
    except Exception as e:
        logger.warning(f"[知识库] 清理图谱数据失败 #{doc_id}: {e}")

    return {"success": True}


@router.get("/image-url")
async def get_image_url(key: str, user: dict = Depends(get_current_user)):
    """Return the backend proxy URL for a MinIO image."""
    from src.storage.minio_client import get_public_url
    url = get_public_url(key)
    return {"url": url}


# 图片代理缓存（LRU，最大 200 条）
from collections import OrderedDict
_image_cache: OrderedDict[str, tuple[bytes, str, float]] = OrderedDict()
_IMAGE_CACHE_TTL = 300  # 5 分钟
_IMAGE_CACHE_MAX = 200


@router.get("/proxy-image/{key:path}")
async def proxy_image(key: str):
    """Proxy image from MinIO through the backend with in-memory LRU cache."""
    import time
    import asyncio
    from fastapi.responses import Response
    from src.storage.minio_client import download_file

    # 检查缓存
    cached = _image_cache.get(key)
    if cached and time.time() - cached[2] < _IMAGE_CACHE_TTL:
        _image_cache.move_to_end(key)
        return Response(content=cached[0], media_type=cached[1])

    ext = key.rsplit(".", 1)[-1].lower() if "." in key else "jpg"
    mime_map = {
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "webp": "image/webp", "gif": "image/gif", "bmp": "image/bmp",
        "svg": "image/svg+xml",
    }
    content_type = mime_map.get(ext, "application/octet-stream")

    try:
        data = await asyncio.to_thread(download_file, key)
        _image_cache[key] = (data, content_type, time.time())
        _image_cache.move_to_end(key)
        # LRU 淘汰
        while len(_image_cache) > _IMAGE_CACHE_MAX:
            _image_cache.popitem(last=False)
        return Response(content=data, media_type=content_type)
    except Exception as e:
        logger.warning(f"Failed to proxy image {key}: {e}")
        return Response(status_code=404)


@router.get("/documents/{doc_id}/markdown")
async def get_document_markdown(doc_id: int, user: dict = Depends(get_current_user)):
    doc = document_service.get_document(doc_id)
    if not doc:
        return {"error": "Document not found"}
    md = doc.get("markdownContent") or doc.get("content") or ""
    return {
        "id": doc["id"],
        "originalName": doc["originalName"],
        "markdown": md,
    }


@router.get("/documents/{doc_id}/download")
async def download_document(doc_id: int, user: dict = Depends(get_current_user)):
    doc = document_service.get_document(doc_id)
    if not doc:
        return {"error": "Document not found"}

    from src.storage.minio_client import get_public_url

    minio_key = None
    conn = document_service._get_conn()
    try:
        row = conn.execute("SELECT minio_key FROM documents WHERE id=?", (doc_id,)).fetchone()
        if row:
            minio_key = row["minio_key"]
    finally:
        conn.close()

    if not minio_key:
        return {"error": "File not available for download"}

    url = get_public_url(minio_key)
    return {"url": url, "filename": doc["originalName"]}


@router.post("/documents/{doc_id}/reparse")
async def reparse_document(doc_id: int, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    doc = document_service.get_document(doc_id)
    if not doc:
        return {"error": "Document not found"}
    if doc["status"] not in ("failed", "completed"):
        return {"error": "只能重新解析失败或已完成的文档"}

    # Get file from MinIO
    from src.storage.minio_client import download_file
    conn = document_service._get_conn()
    try:
        row = conn.execute("SELECT minio_key FROM documents WHERE id=?", (doc_id,)).fetchone()
        minio_key = row["minio_key"] if row else None
    finally:
        conn.close()

    if not minio_key:
        return {"error": "文件未上传到MinIO，无法重新解析"}

    file_content = download_file(minio_key)
    document_service.update_doc_status(doc_id, "parsing", 0)
    background_tasks.add_task(
        _process_document,
        doc_id,
        doc["originalName"],
        file_content,
    )
    return {"success": True, "status": "parsing"}


@router.get("/documents/{doc_id}/logs")
async def get_document_logs(doc_id: int, user: dict = Depends(get_current_user)):
    doc = document_service.get_document(doc_id)
    if not doc:
        return {"error": "Document not found"}
    return {
        "id": doc["id"],
        "status": doc["status"],
        "progress": doc.get("progress"),
        "errorMessage": doc.get("errorMessage"),
    }
