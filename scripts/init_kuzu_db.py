"""Initialize Kuzu database schema."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import settings
from src.storage.kuzu_store import KuzuStore


def main():
    store = KuzuStore(settings.KUZU_DB_PATH)
    print(f"Kuzu database initialized at {settings.KUZU_DB_PATH}")
    print("Schema: Entity node table + 25 REL tables created.")
    print("Done.")


if __name__ == "__main__":
    main()
