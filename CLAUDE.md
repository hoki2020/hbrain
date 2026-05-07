# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HBrain is a knowledge graph system that simulates human brain semantic memory. It extracts entities and relations from documents using LLM agents, stores them in a graph database, and provides intelligent retrieval capabilities.

**Stack**: FastAPI (Python) + Next.js 16 (TypeScript) + Kuzu (Graph DB) + MinIO (Object Storage) + SQLite (Documents/Auth)

## Build & Run Commands

### Backend

```bash
# Install dependencies
make install  # or: pip install -r requirements.txt

# Initialize database
make init-db  # or: python scripts/init_kuzu_db.py

# Start API server
make start-api  # or: python -m uvicorn src.api.app:app --reload --host 127.0.0.1 --port 8000

# Start full server
make start-all  # or: python start_server.py

# Seed demo data
make seed  # or: python scripts/seed_demo.py

# Run tests
make test  # or: pytest tests/ -v
```

### Frontend

```bash
cd front

pnpm dev        # Development server
pnpm build      # Production build
pnpm start      # Production server
pnpm lint       # Run ESLint
```

### Infrastructure

```bash
# Start MinIO container
docker-compose up -d
```

## Architecture

```
Frontend (Next.js)
       │ HTTP/REST
       ▼
Backend (FastAPI)
  ├─ Routes: auth, entities, graph, knowledge, operations, search, users, roles, permissions
  ├─ Agents: FeynmanAgent (extraction), RetrievalAgent (query), EvaluationAgent (scoring)
  ├─ Services: AuthService, DocumentService, KnowledgeService, GraphService
  └─ Storage: KuzuStore (graph), MinIO (files), SQLite (documents/auth)
       │
       ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │   Kuzu   │  │   MinIO  │  │  SQLite  │
  └──────────┘  └──────────┘  └──────────┘
```

### Key Directories

```
src/
  api/
    app.py          # FastAPI application, CORS, lifespan
    deps.py         # Dependency injection (auth, graph store, LLM)
    routes/         # API endpoints (auth, knowledge, graph, etc.)
  agents/
    feynman_agent.py    # Document → Entity/Relation extraction
    retrieval_agent.py  # Query → Graph traversal → Answer
    evaluation_agent.py # Quality scoring and filtering
  models/
    entity.py       # Entity model (13 types: document, agent, object, concept, event, etc.)
    relation.py     # Relation model (22 types: mentions, defines, describes, etc.) + edge weights
    graph.py        # SubGraph, ActivationResult models
  services/
    auth_service.py     # JWT auth, user management, RBAC
    document_service.py # Document CRUD, MinIO upload, MinerU parsing
    knowledge_service.py # Orchestrates extract → evaluate → filter → store pipeline
    graph_service.py    # Graph queries and visualization data
  storage/
    kuzu_store.py   # Kuzu graph database operations
    entity_search.py # SQLite FTS5 entity search index
    minio_client.py # MinIO file storage operations
config/
    settings.py     # Pydantic Settings class with all configuration
prompts/            # LLM prompt templates (feynman_extraction.py, retrieval.py)
front/              # Next.js frontend (React 19, TypeScript, Tailwind, shadcn/ui)
```

## Key Patterns

### Dependency Injection

```python
# src/api/deps.py
def get_current_user(authorization: Optional[str] = Header(None)) -> dict  # JWT auth
@lru_cache() def get_graph_store() -> KuzuStore    # Singleton graph store
@lru_cache() def get_llm() -> BaseLLM               # Singleton LLM client
def get_knowledge_service() -> KnowledgeService     # Fresh service per call
```

### Agent Pattern

Each agent receives LLM + GraphStore:
```python
class FeynmanAgent:
    def __init__(self, llm: BaseLLM, graph_store: GraphStore):
        self._llm = llm
        self._graph = graph_store
```

### Knowledge Pipeline

```
Document → Extract (FeynmanAgent) → Evaluate (EvaluationAgent) → Filter (score < 0.7)
       → Retry (max 2) → Store (KuzuStore)
```

### Query Pipeline

```
Query → Analyze (LLM) → Entity Search (FTS5 parallel) → Weighted BFS (3-hop, TOP 20)
      → Gather Evidence (per-document priority: full_text > paragraph > summary)
      → Filter (LLM) → Compress → Answer (LLM)
```

Multi-hop scoring: `score = edge_weight * 0.7^depth`. Same entity via multiple paths → `max(scores)`.

### Entity Types (13)

`document, agent, object, concept, event, activity, rule, metric, time, location, statement, issue, image`

### Relation Types (22)

`mentions, defines, describes, part_of, contains, belongs_to, responsible_for, performs, uses, creates, requires, prohibits, permits, depends_on, causes, affects, mitigates, measures, attribute, evidence_for, contradicts, derived_from`

Edge weights defined in `src/models/relation.py:EDGE_WEIGHTS` (0.30–1.00). Weak relations (`MENTIONS`, `DESCRIBES`, `EVIDENCE_FOR`, `DERIVED_FROM`, `ATTRIBUTE`) are non-expandable — included in results but don't continue multi-hop expansion.

### Search

Entity search uses SQLite FTS5 (`src/storage/entity_search.py`) with CJK LIKE fallback. Kuzu handles graph relations only.

## Configuration

### Environment Variables (.env)

```bash
JWT_SECRET=<secret>                    # Change from default in production
KUZU_DB_PATH=./data/kuzu/hbrain.kuzu  # Graph database path
LLM_PROVIDER=openai|anthropic         # LLM provider
OPENAI_BASE_URL=http://127.0.0.1:8317/v1
OPENAI_API_KEY=<key>
OPENAI_MODEL=mimo-v2.5-pro
EMBEDDING_PROVIDER=local|openai       # Embedding provider
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin            # Change in production
MINIO_SECRET_KEY=minioadmin            # Change in production
MINIO_BUCKET=hbrain
MINERU_API_TOKEN=<token>              # Document parsing service
API_HOST=0.0.0.0
API_PORT=8000
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Development Notes

### CORS Configuration

The backend allows requests from:
- `http://localhost:3000` (frontend dev server)
- `http://localhost:8000` (backend server)

Update `allow_origins` in `src/api/app.py` if frontend runs on different port.

### Image Proxy

The `/api/knowledge/proxy-image/{key}` endpoint does not require auth (images loaded via `<img>` tags can't send Authorization headers). Security relies on non-guessable key paths.

### Database Initialization

- **Kuzu**: Schema auto-created on `KuzuStore` instantiation. Relation type migrations (e.g., `has_value`→`attribute`) run automatically on startup.
- **SQLite**: Tables created on module import (`init_doc_db()`, `init_auth_db()`). FTS5 search index backfilled on startup (`_backfill_search_index` in `app.py`).
- **Migrations**: Use `ALTER TABLE` for new columns (see `document_service.py`)

### Kuzu Connection Safety

Kuzu connections are NOT thread-safe. Use fresh connections per call:
```python
def _get_conn(self) -> kuzu.Connection:
    return kuzu.Connection(self._db)
```

### LLM Integration

The system supports multiple LLM providers via `config/settings.py`:
- OpenAI-compatible API (default, works with local servers like Ollama)
- Anthropic Claude

Switch providers by setting `LLM_PROVIDER` in `.env`.

### Document Processing

Documents are processed asynchronously via FastAPI `BackgroundTasks`:
1. Upload to MinIO
2. Parse with MinerU VLM API (returns markdown + images)
3. Generate summary with LLM
4. Extract entities/relations with FeynmanAgent
5. Store in Kuzu graph

### Text Snippet Ingestion

Text content (e.g., Q&A history, notes) can be ingested directly without file upload via `POST /api/knowledge/text`:
1. (Optional) Convert to wiki-style markdown with LLM
2. Generate summary with LLM
3. Extract entities/relations with FeynmanAgent
4. Store in Kuzu graph

Documents have a `source_type` field: `'file'` for uploaded files, `'text'` for text snippets.

### Frontend State Management

The frontend uses React Context for auth state and local component state for data. No global state manager (Redux, Zustand) is used. Pages manage their own data fetching and polling.
