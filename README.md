# HBrain - Human Brain Semantic Network

<p align="center">
  <strong>知识图谱系统 | 模拟人脑语义记忆网络</strong>
</p>
---

<p align="center">
  <strong>中文</strong> | <a href="README_en.md">English</a>
</p>

---

## 概述

HBrain 是一个基于大语言模型的知识图谱系统，模拟人脑语义记忆网络的工作方式。系统能够从文档中自动提取实体和关系，构建结构化的知识图谱，并提供智能问答能力。

**核心理念**：将非结构化文档转化为结构化知识，通过图谱连接实现深度语义理解和智能检索。

## 功能特性

### 知识抽取
- **智能实体识别**：自动识别人物、组织、概念、事件等 13 种实体类型
- **关系抽取**：提取实体间的 22 种语义关系（因果、归属、依赖等），支持边权重和多跳打分
- **质量评估**：LLM 驱动的质量评分，自动过滤低置信度结果
- **重试机制**：抽取失败时自动重试，最多 3 次尝试

### 知识图谱
- **可视化展示**：基于 react-force-graph-3d 的 3D 力导向图，支持交互式探索
- **节点详情**：查看实体的费曼总结、置信度、关联关系、来源文档
- **关系过滤**：按节点类型和关系类型筛选图谱内容
- **搜索功能**：支持文本搜索和语义搜索

### 智能检索
- **问题分析**：自动识别问题原型和关键实体
- **加权图遍历**：基于边权重的 3 跳 BFS 扩展，弱关系可召回但不继续扩散
- **证据分级**：按文档优先级（全文 > 段落 > 总结），LLM 过滤无关证据
- **智能回答**：基于证据生成结构化回答

### 文档管理
- **多格式支持**：PDF、Word、PPT、Excel、图片、HTML、TXT
- **文本片段入库**：直接提交文本内容（问答历史、笔记等）到知识库，支持自动转换为百科格式
- **异步处理**：后台上传、解析、抽取，支持进度追踪
- **MinerU 集成**：使用 VLM API 进行文档解析
- **图片代理**：自动提取并代理文档中的图片

### 用户权限
- **JWT 认证**：基于 Token 的身份验证
- **RBAC 权限**：角色-权限模型，支持细粒度权限控制
- **用户管理**：用户注册、登录、密码修改

## 系统架构
<img width="1448" height="1086" alt="c81fb1b1-3650-4898-86eb-8cb0067bc66a" src="https://github.com/user-attachments/assets/81dc6fb1-8489-4b1a-9458-da85709b206a" />

### 核心组件

| 组件 | 技术栈 | 职责 |
|------|--------|------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS | 用户界面和交互 |
| **Backend** | FastAPI, Python 3.10+ | API 服务和业务逻辑 |
| **Graph DB** | Kuzu | 图数据库，存储实体和关系 |
| **Object Storage** | MinIO | 文件存储（文档、图片） |
| **Document DB** | SQLite | 文档元数据和用户认证 |
| **LLM** | OpenAI-compatible / Anthropic | 知识抽取和智能问答 |
| **Document Parser** | MinerU VLM API | 文档解析和 OCR |

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 18+
- pnpm (推荐) 或 npm
- Docker (用于 MinIO)

### 1. 克隆仓库

```bash
git clone https://github.com/yourusername/hbrain.git
cd hbrain
```

### 2. 后端设置

```bash
# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置以下必要参数：
# - JWT_SECRET: 生成随机密钥
# - OPENAI_BASE_URL: LLM API 地址
# - OPENAI_API_KEY: API 密钥
# - MINIO_ACCESS_KEY / MINIO_SECRET_KEY: MinIO 凭据

# 初始化数据库
python scripts/init_kuzu_db.py

# 启动后端服务
python -m uvicorn src.api.app:app --reload --host 0.0.0.0 --port 8000
```

### 3. 前端设置

```bash
cd front

# 安装依赖
pnpm install

# 配置环境变量
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 启动开发服务器
pnpm dev
```

### 4. 启动 MinIO

```bash
# 使用 Docker Compose
docker-compose up -d

# 或手动启动
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -v minio_data:/data \
  minio/minio server /data --console-address ":9001"
```

### 5. 访问系统

- **前端界面**: http://localhost:3000
- **API 文档**: http://localhost:8000/docs
- **MinIO 控制台**: http://localhost:9001 (minioadmin/minioadmin)

## 项目结构

```
hbrain/
├── src/
│   ├── api/
│   │   ├── app.py              # FastAPI 应用入口，CORS 配置
│   │   ├── deps.py             # 依赖注入（认证、图谱存储、LLM）
│   │   └── routes/             # API 路由
│   │       ├── auth.py         # 认证相关（登录、注册、Token）
│   │       ├── knowledge.py    # 知识库管理（文档 CRUD、解析）
│   │       ├── graph.py        # 图谱数据（查询、搜索、统计）
│   │       ├── search.py       # 智能检索
│   │       ├── users.py        # 用户管理
│   │       ├── roles.py        # 角色管理
│   │       └── permissions.py  # 权限管理
│   ├── agents/
│   │   ├── feynman_agent.py    # 知识抽取 Agent
│   │   ├── retrieval_agent.py  # 智能检索 Agent
│   │   ├── evaluation_agent.py # 质量评估 Agent
│   │   └── merge_agent.py      # 实体合并 Agent
│   ├── models/
│   │   ├── entity.py           # 实体模型（13 种类型）
│   │   ├── relation.py         # 关系模型（22 种类型，含边权重）
│   │   └── graph.py            # 图谱模型（SubGraph, ActivationResult）
│   ├── services/
│   │   ├── auth_service.py     # JWT 认证、用户管理、RBAC
│   │   ├── document_service.py # 文档 CRUD、MinIO 上传、MinerU 解析
│   │   ├── knowledge_service.py# 知识抽取管道（抽取→评估→过滤→存储）
│   │   ├── graph_service.py    # 图谱查询和可视化数据
│   │   └── mineru_client.py    # MinerU VLM API 客户端
│   └── storage/
│       ├── kuzu_store.py       # Kuzu 图数据库操作
│       ├── entity_search.py    # SQLite FTS5 全文搜索
│       ├── minio_client.py     # MinIO 文件存储操作
│       └── interfaces.py       # 存储接口定义
├── config/
│   └── settings.py             # Pydantic Settings 配置类
├── prompts/
│   ├── feynman_extraction.py   # 知识抽取提示词
│   ├── retrieval.py            # 智能检索提示词
│   ├── evaluation.py           # 质量评估提示词
│   └── merge_detection.py      # 实体合并检测提示词
├── scripts/
│   └── init_kuzu_db.py         # 初始化 Kuzu 数据库
├── front/                      # Next.js 前端
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── knowledge/      # 知识库管理页面
│   │   │   ├── graph/          # 知识图谱页面
│   │   │   ├── users/          # 用户管理页面
│   │   │   ├── roles/          # 角色管理页面
│   │   │   └── permissions/    # 权限管理页面
│   │   ├── login/              # 登录页面
│   │   └── register/           # 注册页面
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 组件
│   │   └── admin/              # 管理后台组件（侧边栏、头部）
│   ├── lib/
│   │   ├── api.ts              # API 客户端（请求封装、认证）
│   │   ├── auth-context.tsx    # 认证上下文
│   │   ├── types.ts            # TypeScript 类型定义
│   │   └── i18n/               # 国际化（中文简繁体、英文）
│   └── public/                 # 静态资源
├── data/
│   ├── kuzu/                   # Kuzu 数据库文件
│   ├── documents.db            # SQLite 文档数据库
│   └── auth.db                 # SQLite 认证数据库
├── .env                        # 环境变量配置
├── docker-compose.yml          # Docker 配置（MinIO）
├── requirements.txt            # Python 依赖
├── Makefile                    # 常用命令
└── CLAUDE.md                   # Claude Code 开发指南
```

## 环境变量配置

### 后端 (.env)

```bash
# JWT 认证
JWT_SECRET=<生成随机密钥>  # 使用: python -c "import secrets; print(secrets.token_urlsafe(64))"

# Kuzu 图数据库
KUZU_DB_PATH=./data/kuzu/hbrain.kuzu

# LLM 配置
LLM_PROVIDER=openai  # 或 anthropic
OPENAI_BASE_URL=http://127.0.0.1:8317/v1  # 本地 LLM 服务
OPENAI_API_KEY=<your-api-key>
OPENAI_MODEL=mimo-v2.5-pro

# Embedding 配置
EMBEDDING_PROVIDER=local  # 或 openai

# MinIO 对象存储
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin  # 生产环境务必修改
MINIO_SECRET_KEY=minioadmin  # 生产环境务必修改
MINIO_BUCKET=hbrain
MINIO_SECURE=false

# MinerU 文档解析
MINERU_API_TOKEN=<your-token>
MINERU_MODEL=vlm

# API 配置
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=false
```

### 前端 (front/.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API 文档

启动后端服务后，访问以下地址查看 API 文档：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 核心 API 端点

| 模块 | 端点 | 方法 | 说明 |
|------|------|------|------|
| 认证 | `/api/auth/login` | POST | 用户登录 |
| 认证 | `/api/auth/register` | POST | 用户注册 |
| 知识库 | `/api/knowledge/documents` | GET | 获取文档列表 |
| 知识库 | `/api/knowledge/upload` | POST | 上传文档 |
| 知识库 | `/api/knowledge/text` | POST | 提交文本片段到知识库 |
| 知识库 | `/api/knowledge/documents/{id}` | GET | 获取文档详情 |
| 知识库 | `/api/knowledge/documents/{id}` | DELETE | 删除文档 |
| 图谱 | `/api/graph/data` | GET | 获取图谱数据 |
| 图谱 | `/api/graph/search` | GET | 搜索图谱 |
| 图谱 | `/api/graph/stats` | GET | 图谱统计 |
| 检索 | `/api/search/query` | POST | 智能问答 |
| 用户 | `/api/users` | GET | 用户列表 |
| 角色 | `/api/roles` | GET | 角色列表 |
| 权限 | `/api/permissions` | GET | 权限列表 |

## 开发指南

### 常用命令

```bash
# 后端
make install          # 安装依赖
make init-db          # 初始化数据库
make start-server     # 启动后端服务

# 前端
make start-web        # 启动前端开发服务器
```

### 添加新实体类型

1. 在 `src/models/entity.py` 的 `EntityType` 枚举中添加新类型
2. 在 `src/storage/kuzu_store.py` 的 `_LEGACY_TYPE_MAP` 中添加映射
3. 在 `front/app/dashboard/graph/page.tsx` 的 `nodeTypeConfig` 中添加配置
4. 更新 `CLAUDE.md` 中的实体类型列表

### 添加新关系类型

1. 在 `src/models/relation.py` 的 `RelationType` 枚举中添加新类型
2. 在 `src/storage/kuzu_store.py` 中创建对应的 REL 表
3. 在 `src/services/graph_service.py` 的 `RELATION_LABELS` 中添加标签
4. 在 `front/app/dashboard/graph/page.tsx` 的 `edgeTypeConfig` 中添加配置

### 自定义 LLM 提示词

提示词文件位于 `prompts/` 目录：

- `feynman_extraction.py` - 知识抽取提示词
- `retrieval.py` - 智能检索提示词

修改提示词后需要重启后端服务。

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t hbrain-backend .
docker build -t hbrain-frontend ./front

# 启动服务
docker-compose up -d
```

### 生产环境配置

1. **JWT_SECRET**: 使用强随机密钥，不要使用默认值
2. **MinIO 凭据**: 修改默认的 minioadmin 用户名/密码
3. **CORS 配置**: 在 `src/api/app.py` 中配置允许的域名
4. **HTTPS**: 使用反向代理（Nginx/Caddy）配置 SSL
5. **数据库**: 定期备份 `data/` 目录

## 性能优化

### 图谱查询优化

- 使用 `limit` 参数限制返回数据量
- 避免返回全图数据（默认限制 500 节点，1000 条边）
- 使用文本搜索而非全量查询

### 文档处理优化

- 大文件使用分块上传（每块 1MB）
- 图片使用 LRU 缓存（最大 200 条，TTL 5 分钟）
- 异步处理避免阻塞主线程

### LLM 调用优化

- 使用本地 LLM 服务减少网络延迟
- 实现请求缓存避免重复调用
- 设置合理的超时时间

## 故障排查

### 常见问题

**Q: 启动时提示 JWT_SECRET 使用默认值**
A: 在 `.env` 文件中设置随机密钥：
```bash
JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(64))")
```

**Q: 上传文件失败**
A: 检查 MinIO 服务是否运行：
```bash
docker ps | grep minio
curl http://localhost:9000/minio/health/live
```

**Q: 图谱数据为空**
A: 检查 Kuzu 数据库是否初始化：
```bash
python scripts/init_kuzu_db.py
```

**Q: LLM 调用失败**
A: 检查 LLM 服务是否可访问：
```bash
curl http://127.0.0.1:8317/v1/models
```

## 参与贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/your-feature`)
3. 提交更改 (`git commit -m 'Add some feature'`)
4. 推送到分支 (`git push origin feature/your-feature`)
5. 创建 Pull Request

### 代码规范

- **Python**: 遵循 PEP 8，使用类型注解
- **TypeScript**: 使用 ESLint，遵循项目配置
- **Git**: 使用 Conventional Commits 规范

### 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

## 许可证

本项目采用 Apache License 2.0 许可证。详见 [LICENSE](LICENSE) 文件。

## 致谢

- [Kuzu](https://kuzudb.com/) - 高性能图数据库
- [MinIO](https://min.io/) - 对象存储
- [FastAPI](https://fastapi.tiangolo.com/) - Web 框架
- [Next.js](https://nextjs.org/) - React 框架
- [react-force-graph-3d](https://github.com/vasturiano/react-force-graph) - 3D 力导向图可视化
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库

## 联系方式

- 问题反馈: [GitHub Issues](https://github.com/hoki2020/hbrain/issues)
- 邮箱: zhanxuejian@gmail.com

---

<p align="center">
  <strong>HBrain</strong> - 将知识转化为智慧
</p>
