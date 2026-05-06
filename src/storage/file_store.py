from __future__ import annotations

import json
import os
from datetime import datetime

from src.storage.interfaces import DocumentStore


class FileStore(DocumentStore):
    def __init__(self, base_dir: str = "./data"):
        self._base_dir = base_dir
        self._sources_dir = os.path.join(base_dir, "sources")
        self._exports_dir = os.path.join(base_dir, "exports")
        os.makedirs(self._sources_dir, exist_ok=True)
        os.makedirs(self._exports_dir, exist_ok=True)

    async def save_source(
        self, entity_id: str, content: str, metadata: dict
    ) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{entity_id}_{timestamp}.txt"
        filepath = os.path.join(self._sources_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"# Source for entity: {entity_id}\n")
            f.write(f"# Metadata: {json.dumps(metadata, ensure_ascii=False)}\n")
            f.write(f"# Saved at: {datetime.utcnow().isoformat()}\n\n")
            f.write(content)

        return filepath

    async def load_source(self, path: str) -> str:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    async def export_graph(self, data: dict, filename: str) -> str:
        filepath = os.path.join(self._exports_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath

    async def import_source(self, filepath: str) -> str:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
