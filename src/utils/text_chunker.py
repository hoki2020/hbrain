from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class TextChunk:
    content: str           # chunk 文本（含标题上下文）
    heading: str           # 当前 chunk 的直接标题
    heading_path: str      # 完整标题路径，如 "第一章 > 第二节 > 小节"
    offset: int            # 在原文中的字符偏移
    index: int             # chunk 序号


# 匹配 Markdown 标题行：# ~ ######
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


def _heading_level(match: re.Match) -> int:
    return len(match.group(1))


def _build_heading_path(headings_stack: list[tuple[int, str]]) -> str:
    return " > ".join(h for _, h in headings_stack)


def chunk_markdown(
    text: str,
    max_chunk_size: int = 20000,
    overlap: int = 500,
    min_chunk_size: int = 2000,
) -> List[TextChunk]:
    """Split markdown text into chunks by headings.

    Strategy:
    1. Split by # headings (h1/h2/h3)
    2. If a section exceeds max_chunk_size, sub-split by paragraphs
    3. Merge small adjacent sections to avoid fragmentation
    4. Each chunk carries its heading_path and offset for tracing
    """
    if len(text) <= max_chunk_size:
        return [TextChunk(
            content=text,
            heading="",
            heading_path="",
            offset=0,
            index=0,
        )]

    # Step 1: Find all heading positions
    heading_matches = list(_HEADING_RE.finditer(text))

    if not heading_matches:
        # No headings at all — split by paragraphs
        return _split_by_paragraphs(text, max_chunk_size, overlap, min_chunk_size)

    # Step 2: Split text into sections by headings
    sections: list[tuple[int, int, int, str]] = []  # (start, end, level, title)
    for i, m in enumerate(heading_matches):
        start = m.start()
        end = heading_matches[i + 1].start() if i + 1 < len(heading_matches) else len(text)
        level = _heading_level(m)
        title = m.group(2).strip()
        sections.append((start, end, level, title))

    # Add text before first heading if any
    if heading_matches[0].start() > 0:
        pre_text = text[:heading_matches[0].start()].strip()
        if pre_text:
            sections.insert(0, (0, heading_matches[0].start(), 0, ""))

    # Step 3: Build chunks with heading context
    chunks: list[TextChunk] = []
    headings_stack: list[tuple[int, str]] = []  # (level, title)
    pending_sections: list[tuple[str, str, int]] = []  # (content, heading_path, offset)

    def _flush_pending():
        """Merge pending small sections into chunks."""
        if not pending_sections:
            return
        combined_content = ""
        combined_path = ""
        combined_offset = 0
        for content, path, offset in pending_sections:
            if not combined_content:
                combined_offset = offset
                combined_path = path
            combined_content += ("\n\n" if combined_content else "") + content

        # If combined is still too large, split by paragraphs
        if len(combined_content) > max_chunk_size:
            sub_chunks = _split_by_paragraphs(
                combined_content, max_chunk_size, overlap, min_chunk_size
            )
            for sc in sub_chunks:
                chunks.append(TextChunk(
                    content=sc.content,
                    heading=sc.heading,
                    heading_path=combined_path,
                    offset=combined_offset + sc.offset,
                    index=len(chunks),
                ))
        else:
            chunks.append(TextChunk(
                content=combined_content,
                heading=pending_sections[0][1].split(" > ")[-1] if pending_sections[0][1] else "",
                heading_path=combined_path,
                offset=combined_offset,
                index=len(chunks),
            ))
        pending_sections.clear()

    for start, end, level, title in sections:
        # Update heading stack
        while headings_stack and headings_stack[-1][0] >= level:
            headings_stack.pop()
        if title:
            headings_stack.append((level, title))

        section_text = text[start:end].strip()
        if not section_text:
            continue

        path = _build_heading_path(headings_stack)

        if len(section_text) > max_chunk_size:
            # Section too large — flush pending, then split this section
            _flush_pending()
            sub_chunks = _split_by_paragraphs(
                section_text, max_chunk_size, overlap, min_chunk_size
            )
            for sc in sub_chunks:
                chunks.append(TextChunk(
                    content=sc.content,
                    heading=title or sc.heading,
                    heading_path=path,
                    offset=start + sc.offset,
                    index=len(chunks),
                ))
        elif len(section_text) < min_chunk_size:
            # Small section — accumulate
            pending_sections.append((section_text, path, start))
        else:
            # Normal section — flush pending, then add
            _flush_pending()
            chunks.append(TextChunk(
                content=section_text,
                heading=title,
                heading_path=path,
                offset=start,
                index=len(chunks),
            ))

    _flush_pending()

    # Step 4: Merge adjacent small chunks
    return _merge_small_chunks(chunks, min_chunk_size, max_chunk_size)


def _split_by_paragraphs(
    text: str,
    max_chunk_size: int,
    overlap: int,
    min_chunk_size: int,
) -> List[TextChunk]:
    """Split text by paragraph boundaries (\n\n)."""
    paragraphs = re.split(r"\n\n+", text)
    chunks: list[TextChunk] = []
    current = ""
    current_offset = 0
    para_offset = 0

    for para in paragraphs:
        para_with_sep = para + "\n\n"
        if len(current) + len(para_with_sep) > max_chunk_size and current:
            chunks.append(TextChunk(
                content=current.strip(),
                heading="",
                heading_path="",
                offset=current_offset,
                index=len(chunks),
            ))
            # Overlap: keep last part of previous chunk
            if overlap > 0 and len(current) > overlap:
                current = current[-overlap:] + para_with_sep
                current_offset = para_offset - overlap
            else:
                current = para_with_sep
                current_offset = para_offset
        else:
            if not current:
                current_offset = para_offset
            current += para_with_sep
        para_offset += len(para_with_sep)

    if current.strip():
        chunks.append(TextChunk(
            content=current.strip(),
            heading="",
            heading_path="",
            offset=current_offset,
            index=len(chunks),
        ))

    return chunks


def _merge_small_chunks(
    chunks: List[TextChunk],
    min_size: int,
    max_size: int,
) -> List[TextChunk]:
    """Merge adjacent small chunks to avoid fragmentation."""
    if len(chunks) <= 1:
        return chunks

    merged: list[TextChunk] = []
    buffer: TextChunk | None = None

    for chunk in chunks:
        if buffer is None:
            buffer = chunk
            continue

        if len(buffer.content) < min_size and len(buffer.content) + len(chunk.content) <= max_size:
            # Merge into buffer
            buffer = TextChunk(
                content=buffer.content + "\n\n" + chunk.content,
                heading=buffer.heading,
                heading_path=buffer.heading_path,
                offset=buffer.offset,
                index=buffer.index,
            )
        else:
            merged.append(buffer)
            buffer = chunk

    if buffer:
        merged.append(buffer)

    # Re-index
    for i, c in enumerate(merged):
        c.index = i

    return merged
