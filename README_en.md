# HBrain - Human Brain Semantic Network

<p align="center">
  <strong>Knowledge Graph System | Simulating Human Brain Semantic Memory Network</strong>
</p>

---

<p align="center">
  <a href="README.md">中文</a> | <strong>English</strong>
</p>

---

## Overview

HBrain is a knowledge graph system powered by Large Language Models (LLMs) that simulates the working mechanism of human brain semantic memory networks. The system automatically extracts entities and relationships from documents, constructs structured knowledge graphs, and provides intelligent Q&A capabilities.

**Core Philosophy**: Transform unstructured documents into structured knowledge, achieving deep semantic understanding and intelligent retrieval through graph connections.

## Features

### Knowledge Extraction
- **Intelligent Entity Recognition**: Automatically identifies 13 entity types including persons, organizations, concepts, events, etc.
- **Relationship Extraction**: Extracts 22 semantic relationships between entities (causal, ownership, dependency, etc.), supports edge weights and multi-hop scoring
- **Quality Evaluation**: LLM-driven quality scoring with automatic filtering of low-confidence results
- **Retry Mechanism**: Automatic retry on extraction failure, up to 3 attempts

### Knowledge Graph
- **Visualization**: react-force-graph-3d 3D force-directed layout with interactive exploration
- **Node Details**: View Feynman summaries, confidence scores, relationships, and source documents
- **Relation Filtering**: Filter graph content by node type and relationship type
- **Search**: Support for text search and semantic search

### Intelligent Retrieval
- **Question Analysis**: Automatic identification of problem archetypes and key entities
- **Weighted Graph Traversal**: 3-hop BFS expansion based on edge weights, weak relations recalled but not expanded
- **Evidence Grading**: Per-document priority (full text > paragraph > summary), LLM filters irrelevant evidence
- **Intelligent Answers**: Generate structured answers based on evidence

### Document Management
- **Multi-format Support**: PDF, Word, PPT, Excel, images, HTML, TXT
- **Text Snippet Ingestion**: Directly submit text content (Q&A history, notes) to knowledge base via API
- **Asynchronous Processing**: Background upload, parsing, extraction with progress tracking
- **MinerU Integration**: Document parsing using VLM API
- **Image Proxy**: Automatic extraction and proxying of document images

### User Permissions
- **JWT Authentication**: Token-based identity verification
- **RBAC Permissions**: Role-permission model with fine-grained access control
- **User Management**: User registration, login, password modification

## System Architecture

<img width="1448" height="1086" alt="c81fb1b1-3650-4898-86eb-8cb0067bc66a" src="https://github.com/user-attachments/assets/81dc6fb1-8489-4b1a-9458-da85709b206a" />

### Core Components

| Component | Tech Stack | Responsibility |
|-----------|------------|----------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS | User interface and interaction |
| **Backend** | FastAPI, Python 3.10+ | API services and business logic |
| **Graph DB** | Kuzu | Graph database for storing entities and relationships |
| **Object Storage** | MinIO | File storage (documents, images) |
| **Document DB** | SQLite | Document metadata and user authentication |
| **LLM** | OpenAI-compatible / Anthropic | Knowledge extraction and intelligent Q&A |
| **Document Parser** | MinerU VLM API | Document parsing and OCR |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- pnpm (recommended) or npm
- Docker (for MinIO)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/hbrain.git
cd hbrain
```

### 2. Backend Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env file with required parameters:
# - JWT_SECRET: Generate random secret
# - OPENAI_BASE_URL: LLM API endpoint
# - OPENAI_API_KEY: API key
# - MINIO_ACCESS_KEY / MINIO_SECRET_KEY: MinIO credentials

# Initialize database
python scripts/init_kuzu_db.py

# Start backend service
python -m uvicorn src.api.app:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

```bash
cd front

# Install dependencies
pnpm install

# Configure environment variables
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start development server
pnpm dev
```

### 4. Start MinIO

```bash
# Using Docker Compose
docker-compose up -d

# Or manually
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -v minio_data:/data \
  minio/minio server /data --console-address ":9001"
```

### 5. Access System

- **Frontend Interface**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## Project Structure

```
hbrain/
├── src/
│   ├── api/
│   │   ├── app.py              # FastAPI application entry, CORS config
│   │   ├── deps.py             # Dependency injection (auth, graph store, LLM)
│   │   └── routes/             # API routes
│   │       ├── auth.py         # Authentication (login, register, token)
│   │       ├── knowledge.py    # Knowledge base management (document CRUD, parsing)
│   │       ├── graph.py        # Graph data (query, search, statistics)
│   │       ├── search.py       # Intelligent retrieval
│   │       ├── users.py        # User management
│   │       ├── roles.py        # Role management
│   │       └── permissions.py  # Permission management
│   ├── agents/
│   │   ├── feynman_agent.py    # Knowledge extraction agent
│   │   ├── retrieval_agent.py  # Intelligent retrieval agent
│   │   ├── evaluation_agent.py # Quality evaluation agent
│   │   └── merge_agent.py      # Entity merge agent
│   ├── models/
│   │   ├── entity.py           # Entity model (13 types)
│   │   ├── relation.py         # Relation model (22 types, with edge weights)
│   │   └── graph.py            # Graph model (SubGraph, ActivationResult)
│   ├── services/
│   │   ├── auth_service.py     # JWT auth, user management, RBAC
│   │   ├── document_service.py # Document CRUD, MinIO upload, MinerU parsing
│   │   ├── knowledge_service.py# Knowledge extraction pipeline
│   │   ├── graph_service.py    # Graph queries and visualization data
│   │   └── mineru_client.py    # MinerU VLM API client
│   └── storage/
│       ├── kuzu_store.py       # Kuzu graph database operations
│       ├── entity_search.py    # SQLite FTS5 full-text search
│       ├── minio_client.py     # MinIO file storage operations
│       └── interfaces.py       # Storage interface definitions
├── config/
│   └── settings.py             # Pydantic Settings configuration class
├── prompts/
│   ├── feynman_extraction.py   # Knowledge extraction prompts
│   ├── retrieval.py            # Intelligent retrieval prompts
│   ├── evaluation.py           # Quality evaluation prompts
│   └── merge_detection.py      # Entity merge detection prompts
├── scripts/
│   └── init_kuzu_db.py         # Initialize Kuzu database
├── front/                      # Next.js frontend
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── knowledge/      # Knowledge base management page
│   │   │   ├── graph/          # Knowledge graph page
│   │   │   ├── users/          # User management page
│   │   │   ├── roles/          # Role management page
│   │   │   └── permissions/    # Permission management page
│   │   ├── login/              # Login page
│   │   └── register/           # Registration page
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   └── admin/              # Admin components (sidebar, header)
│   ├── lib/
│   │   ├── api.ts              # API client (request wrapper, auth)
│   │   ├── auth-context.tsx    # Authentication context
│   │   ├── types.ts            # TypeScript type definitions
│   │   └── i18n/               # Internationalization (zh-CN, zh-TW, en)
│   └── public/                 # Static assets
├── data/
│   ├── kuzu/                   # Kuzu database files
│   ├── documents.db            # SQLite document database
│   └── auth.db                 # SQLite authentication database
├── .env                        # Environment variables
├── docker-compose.yml          # Docker configuration (MinIO)
├── requirements.txt            # Python dependencies
├── Makefile                    # Common commands
└── CLAUDE.md                   # Claude Code development guide
```

## Environment Variables

### Backend (.env)

```bash
# JWT Authentication
JWT_SECRET=<generate-random-secret>  # Use: python -c "import secrets; print(secrets.token_urlsafe(64))"

# Kuzu Graph Database
KUZU_DB_PATH=./data/kuzu/hbrain.kuzu

# LLM Configuration
LLM_PROVIDER=openai  # or anthropic
OPENAI_BASE_URL=http://127.0.0.1:8317/v1  # Local LLM service
OPENAI_API_KEY=<your-api-key>
OPENAI_MODEL=mimo-v2.5-pro

# Embedding Configuration
EMBEDDING_PROVIDER=local  # or openai

# MinIO Object Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin  # Change in production
MINIO_SECRET_KEY=minioadmin  # Change in production
MINIO_BUCKET=hbrain
MINIO_SECURE=false

# MinerU Document Parsing
MINERU_API_TOKEN=<your-token>
MINERU_MODEL=vlm

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=false
```

### Frontend (front/.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Documentation

After starting the backend service, visit the following URLs for API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Core API Endpoints

| Module | Endpoint | Method | Description |
|--------|----------|--------|-------------|
| Auth | `/api/auth/login` | POST | User login |
| Auth | `/api/auth/register` | POST | User registration |
| Knowledge | `/api/knowledge/documents` | GET | List documents |
| Knowledge | `/api/knowledge/upload` | POST | Upload document |
| Knowledge | `/api/knowledge/text` | POST | Submit text snippet to knowledge base |
| Knowledge | `/api/knowledge/documents/{id}` | GET | Get document details |
| Knowledge | `/api/knowledge/documents/{id}` | DELETE | Delete document |
| Graph | `/api/graph/data` | GET | Get graph data |
| Graph | `/api/graph/search` | GET | Search graph |
| Graph | `/api/graph/stats` | GET | Graph statistics |
| Search | `/api/search/query` | POST | Intelligent Q&A |
| Users | `/api/users` | GET | User list |
| Roles | `/api/roles` | GET | Role list |
| Permissions | `/api/permissions` | GET | Permission list |

## Development Guide

### Common Commands

```bash
# Backend
make install          # Install dependencies
make init-db          # Initialize database
make start-server     # Start backend service

# Frontend
make start-web        # Start frontend development server
```

### Adding New Entity Types

1. Add new type to `EntityType` enum in `src/models/entity.py`
2. Add mapping in `_LEGACY_TYPE_MAP` in `src/storage/kuzu_store.py`
3. Add configuration in `nodeTypeConfig` in `front/app/dashboard/graph/page.tsx`
4. Update entity type list in `CLAUDE.md`

### Adding New Relationship Types

1. Add new type to `RelationType` enum in `src/models/relation.py`
2. Create corresponding REL table in `src/storage/kuzu_store.py`
3. Add label in `RELATION_LABELS` in `src/services/graph_service.py`
4. Add configuration in `edgeTypeConfig` in `front/app/dashboard/graph/page.tsx`

### Customizing LLM Prompts

Prompt files are located in the `prompts/` directory:

- `feynman_extraction.py` - Knowledge extraction prompts
- `retrieval.py` - Intelligent retrieval prompts

Restart the backend service after modifying prompts.

## Deployment

### Docker Deployment

```bash
# Build images
docker build -t hbrain-backend .
docker build -t hbrain-frontend ./front

# Start services
docker-compose up -d
```

### Production Configuration

1. **JWT_SECRET**: Use a strong random secret, do not use default values
2. **MinIO Credentials**: Change default minioadmin username/password
3. **CORS Configuration**: Configure allowed domains in `src/api/app.py`
4. **HTTPS**: Use reverse proxy (Nginx/Caddy) for SSL configuration
5. **Database**: Regularly backup the `data/` directory

## Performance Optimization

### Graph Query Optimization

- Use `limit` parameter to restrict returned data volume
- Avoid returning full graph data (default limit: 500 nodes, 1000 edges)
- Use text search instead of full queries

### Document Processing Optimization

- Use chunked upload for large files (1MB per chunk)
- Use LRU cache for images (max 200 entries, 5min TTL)
- Asynchronous processing to avoid blocking main thread

### LLM Call Optimization

- Use local LLM service to reduce network latency
- Implement request caching to avoid duplicate calls
- Set reasonable timeout values

## Troubleshooting

### Common Issues

**Q: Startup warning about JWT_SECRET using default value**
A: Set a random secret in `.env` file:
```bash
JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(64))")
```

**Q: File upload fails**
A: Check if MinIO service is running:
```bash
docker ps | grep minio
curl http://localhost:9000/minio/health/live
```

**Q: Graph data is empty**
A: Check if Kuzu database is initialized:
```bash
python scripts/init_kuzu_db.py
```

**Q: LLM call fails**
A: Check if LLM service is accessible:
```bash
curl http://127.0.0.1:8317/v1/models
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Create a Pull Request

### Code Standards

- **Python**: Follow PEP 8, use type annotations
- **TypeScript**: Use ESLint, follow project configuration
- **Git**: Use Conventional Commits specification

### Commit Convention

```
feat: New feature
fix: Bug fix
docs: Documentation update
style: Code style (no logic changes)
refactor: Refactoring
test: Test related
chore: Build/tool related
```

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) file.

## Acknowledgments

- [Kuzu](https://kuzudb.com/) - High-performance graph database
- [MinIO](https://min.io/) - Object storage
- [FastAPI](https://fastapi.tiangolo.com/) - Web framework
- [Next.js](https://nextjs.org/) - React framework
- [react-force-graph-3d](https://github.com/vasturiano/react-force-graph) - 3D force-directed graph visualization
- [shadcn/ui](https://ui.shadcn.com/) - UI component library

## Contact

- Issue Tracking: [GitHub Issues](https://github.com/hoki2020/hbrain/issues)
- Email: zhanxuejian@gmail.com

---

<p align="center">
  <strong>HBrain</strong> - Transforming Knowledge into Wisdom
</p>
