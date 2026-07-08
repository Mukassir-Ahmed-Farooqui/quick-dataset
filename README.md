<div align="center">

<br/>

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║      ██████╗ ██╗   ██╗██╗ ██████╗██╗  ██╗                   ║
║     ██╔═══██╗██║   ██║██║██╔════╝██║ ██╔╝                   ║
║     ██║   ██║██║   ██║██║██║     █████╔╝                    ║
║     ██║▄▄ ██║██║   ██║██║██║     ██╔═██╗                    ║
║     ╚██████╔╝╚██████╔╝██║╚██████╗██║  ██╗                   ║
║      ╚══▀▀═╝  ╚═════╝ ╚═╝ ╚═════╝╚═╝  ╚═╝                   ║
║                                                              ║
║      ██████╗  █████╗ ████████╗ █████╗ ███████╗███████╗████████╗ ║
║      ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝ ║
║      ██║  ██║███████║   ██║   ███████║███████╗█████╗     ██║    ║
║      ██║  ██║██╔══██║   ██║   ██╔══██║╚════██║██╔══╝     ██║    ║
║      ██████╔╝██║  ██║   ██║   ██║  ██║███████║███████╗   ██║    ║
║      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝    ║
║                                                              ║
║                     Q U I C K   D A T A S E T                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### 🧬 Turn raw documents into production-ready LLM fine-tuning datasets.
**Your docs · Your keys · Your data.**

<br/>

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io)

<br/>

</div>

---

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Folder Structure](#-folder-structure)
- [Installation Guide](#-installation-guide)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Configuration](#-configuration)
- [Development Workflow](#-development-workflow)
- [Application Flow](#-application-flow)
- [API Documentation](#-api-documentation)
- [Database](#-database)
- [Security](#-security)
- [Performance](#-performance)
- [Error Handling](#-error-handling)
- [Scripts](#-scripts)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Limitations](#-limitations)
- [Future Roadmap](#-future-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [FAQ](#-faq)
- [Troubleshooting](#-troubleshooting)

---

## 🌐 Project Overview

### What is Quick Dataset?

Quick Dataset is a **full-stack, multi-user web platform** that transforms raw documents — PDFs, DOCX files, Markdown, and plain text — into clean, reviewed, export-ready fine-tuning datasets for Large Language Models.

### What problem does it solve?

Fine-tuning LLMs requires high-quality custom datasets, but turning source material into structured Q&A pairs, MCQs, or classification data is almost entirely manual. Existing tools like EasyDataset proved the pipeline concept but are single-user, self-hosted, and lack cost transparency. Quick Dataset solves this by providing a multi-user, BYOK (Bring Your Own Key) platform with full traceability, cost estimation before every generation step, and human-in-the-loop review at every stage.

### Who is it for?

- **AI Engineers** fine-tuning open or closed-source models on domain-specific data
- **ML Teams** at startups building custom datasets from internal docs, manuals, or knowledge bases
- **Researchers** who need structured, traceable datasets for experiments
- **Students & Practitioners** learning the dataset-creation pipeline hands-on

### Core Capabilities

| Capability | Description |
|:---|:---|
| **Document Ingestion** | Upload PDF, DOCX, Markdown, and TXT files with MD5 deduplication |
| **Intelligent Chunking** | Split documents using recursive, markdown-aware, or token-based strategies with live preview |
| **Genre/Audience Diversification** | Generate Genre/Audience pairs to diversify question style across chunks |
| **Question Generation** | Generate questions per chunk, optionally crossed with GA pairs |
| **Answer Generation** | Produce QA pairs, MCQs, or Classification labels with optional Chain-of-Thought |
| **Human Review** | Bulk review, edit, confirm, and delete at every pipeline stage |
| **Multi-Format Export** | Export to JSON, JSONL, Alpaca, and ShareGPT formats with filter controls |
| **Cost Transparency** | See projected token count and cost *before* every generation step |
| **Full Lineage** | Every generated row traces back to its exact model, prompt version, and source document |

### Key Highlights

- **BYOK Architecture** — Uses your own LLM API keys (OpenRouter, OpenAI, Groq, Gemini). The platform never holds provider keys of its own.
- **Estimate Before Generate** — Every generation endpoint has a paired `/estimate` endpoint. You always see cost projections before spending tokens.
- **Soft Deletes Everywhere** — Every entity with downstream dependents uses `deleted_at`. Accidental deletes are always reversible.
- **Append-Only Prompt Versioning** — Prompt edits create new versions; old generation runs still point to the exact prompt that produced them.
- **Single Tracked Call Wrapper** — Every LLM call in the app passes through `tracked_complete()`, guaranteeing exactly one usage log row per call.

---

## ✨ Features

### 🔐 Authentication & User Management
- Email + password registration with inline validation (min 8 chars, must contain letter + number)
- JWT access tokens (15-minute expiry) + refresh tokens (30-day expiry)
- Automatic token refresh with request queuing on 401
- Session rehydration on app mount via `/auth/me`
- Protected and public route guards

### 📊 Project Dashboard
- Project CRUD with soft delete
- Pipeline progress tracker (documents → chunks → questions → dataset items)
- Aggregate counts (documents, questions, dataset items) computed via batch queries — no N+1
- Default LLM key assignment per project

### 🤖 LLM Provider Management
- Support for **4 providers**: OpenRouter, OpenAI, Groq, Gemini
- API key encryption at rest using Fernet (AES-256)
- Key validation via real provider test connection
- Masked key display in all API responses — raw keys never echoed back
- Key rotation support (update API key while keeping the same record)

### 📄 Document Processing
- Multi-file drag-and-drop upload
- Supported formats: PDF (via pdfplumber), DOCX (via python-docx), Markdown, Plain Text
- MD5-based deduplication — prevents re-uploading identical files
- Background parsing with live status tracking (queued → parsing → parsed/failed)
- Documents stored in local `storage/` directory (R2 integration planned for production)

### 🧩 Chunking Engine
- Three strategies: `recursive` (LangChain-based), `markdown` (heading-aware), `token` (tiktoken-based)
- Configurable chunk size (100–8000 chars) and overlap
- Live preview: see 3 sample chunks before committing a full generation run
- Token count computed per chunk using `tiktoken` (cl100k_base encoding)
- Inline chunk editing with downstream impact warnings

### 🎭 Genre/Audience Pairs
- LLM-generated or manually created per document
- Controls question diversity: "FAQ for beginners" produces different questions than "troubleshooting for engineers"
- Configurable count per document (1–10)
- CRUD with update support

### ❓ Question Generation
- Generate questions per chunk, optionally crossed with GA pairs
- Combinatorial: N chunks × M GA pairs × Q questions-per-combination
- Live cost estimate panel updates as selections change
- Bulk review UI with multi-select, inline edit, search, and filters (status, chunk, GA pair, generation run)
- Manual question creation alongside LLM generation

### ✅ Answer Generation & Dataset Items
- Three dataset types: **QA** (question/answer), **MCQ** (question/options/correct_answer), **Classification** (text/label)
- JSONB payload per dataset type — validated via Pydantic discriminated unions (`QAPayload`, `MCQPayload`, `ClassificationPayload`)
- Optional Chain-of-Thought generation
- Bulk confirm/delete operations (up to 2000 items)
- AI evaluation scoring (schema ready, generation not yet implemented)
- Denormalized source tracking: every dataset item links back to its source document and chunk

### 📦 Export System
- Four formats: **JSON**, **JSONL**, **Alpaca**, **ShareGPT**
- Filter-based export: confirmed only, minimum score, specific generation run
- Background export generation with status tracking
- Export history with filter snapshot per export
- File download via direct file response (R2 presigned URL planned for production)

### 🔍 Global Search
- Cross-entity search across documents, chunks, GA pairs, and questions
- GIN full-text search indexes on `chunks.content` and `questions.question`
- ILIKE fallback for non-indexed entities
- Returns entity type, id, title, and snippet per result

### ✏️ Prompt Playground
- Per-project, per-prompt-type customization (GA, question, answer, evaluation, conversation, CoT)
- Append-only versioning — every edit creates a new version
- Variable chip support (`{{chunk_content}}`, `{{genre_title}}`, etc.)
- Two distinct actions: **Render Preview** (free, instant string substitution) and **Test with LLM** (real costed call)
- Version history browsable per prompt type

### 📈 Task System
- Every generation operation returns `202 + task_id`
- Universal progress polling via `GET /tasks/{id}`
- Per-item error tracking in `error_log` JSONB
- Task cancellation support via `cancel_requested` flag
- Retry count tracking with configurable max retries

### 💰 Usage & Cost Tracking
- Every LLM call logged via `llm_usage_logs` (provider, model, tokens in/out, estimated cost, latency, status)
- Central pricing engine with model-level pricing for 40+ models
- Provider-level and flat fallback pricing for unknown models
- Estimate endpoints project cost without making LLM calls

---

## 🛠️ Tech Stack

### Backend

| Technology | Version | Purpose |
|:---|:---|:---|
| **Python** | 3.11+ | Runtime |
| **FastAPI** | Latest | Async web framework, auto-generated OpenAPI docs |
| **SQLAlchemy** | Latest | ORM with JSONB support, relationship mapping |
| **Alembic** | Latest | Database migration management |
| **PostgreSQL** | 15+ | Primary database (hosted on [Neon](https://neon.tech) for serverless) |
| **Pydantic v2** | Latest | Request/response validation via `pydantic-settings` |
| **python-jose** | Latest | JWT token generation and validation |
| **passlib + bcrypt** | bcrypt <4.0.0 | Password hashing |
| **cryptography (Fernet)** | Latest | AES-256 encryption for API keys at rest |
| **pdfplumber** | Latest | PDF document parsing |
| **tiktoken** | Latest | Token counting (cl100k_base encoding) |
| **uvicorn** | Latest | ASGI server |

### Frontend

| Technology | Version | Purpose |
|:---|:---|:---|
| **React** | 19.x | UI framework |
| **TypeScript** | ~6.0 | Type-safe development |
| **Vite** | 8.x | Dev server and build tool |
| **TailwindCSS** | 3.4.x | Utility-first CSS with custom design tokens |
| **Radix UI** | Latest | Accessible primitives (Dialog, Dropdown, Tooltip, ScrollArea, Separator, Slot) |
| **TanStack Query** | 5.x | Server state management with 5-minute stale time, 1 retry |
| **React Router** | 7.x | Client-side routing with lazy loading |
| **Framer Motion** | 12.x | Animations and transitions |
| **react-hook-form + Zod** | Latest | Form state management with schema validation |
| **Axios** | 1.18.x | HTTP client with interceptors for auth and error normalization |
| **Sonner** | 2.x | Toast notifications |
| **Lucide React** | 1.x | Icon library |
| **class-variance-authority** | 0.7.x | Component variant management |
| **pnpm** | 9+ | Package manager |

### Infrastructure

| Component | Technology |
|:---|:---|
| **Database** | PostgreSQL via [Neon](https://neon.tech) (serverless) or local |
| **Storage** | Local filesystem (v1), Cloudflare R2 planned for production |
| **Background Jobs** | FastAPI `BackgroundTasks` (in-process, v1) |
| **Authentication** | JWT (HS256) |
| **API Key Encryption** | Fernet (AES-256) |

---

## 🏗️ Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Frontend — React 19 + TypeScript"]
        UI["UI Components<br/>(Radix + Tailwind)"]
        State["TanStack Query<br/>(Server State)"]
        Auth["AuthContext<br/>(JWT Tokens)"]
    end

    subgraph Server["⚙️ Backend — FastAPI"]
        API["API Layer<br/>(12 route modules)"]
        Services["Service Layer<br/>(Generation, Parsing, Chunking, LLM)"]
        Repos["Repository Layer<br/>(Soft-delete-aware queries)"]
        Models["Model Layer<br/>(SQLAlchemy ORM, 15 tables)"]
    end

    subgraph External["☁️ External"]
        DB[("PostgreSQL<br/>(Neon)")]
        LLM["LLM Providers<br/>(OpenRouter / OpenAI / Groq / Gemini)"]
        Storage["File Storage<br/>(Local / R2)"]
    end

    Client -->|REST API / JSON| Server
    API --> Services
    Services --> Repos
    Services -->|tracked_complete| LLM
    Repos --> Models
    Models --> DB
    Services --> Storage
```

### Backend Layer Architecture

```mermaid
graph TD
    subgraph API["API Layer (app/api/)"]
        A1[auth]
        A2[providers]
        A3[projects]
        A4[documents]
        A5[chunks]
        A6[ga_pairs]
        A7[questions]
        A8[dataset_items]
        A9[exports]
        A10[prompts]
        A11[search]
        A12[tasks]
    end

    subgraph Services["Service Layer (app/services/)"]
        S1[parsing/<br/>PDF, DOCX, MD, TXT]
        S2[chunking/<br/>recursive, markdown, token]
        S3[generation/<br/>GA, question, answer<br/>resolver, estimator]
        S4[llm/<br/>tracked_call, provider_factory<br/>4 provider clients]
        S5[prompts/<br/>versioning, templates]
        S6[usage/<br/>cost tracking]
    end

    subgraph Repos["Repository Layer (app/repositories/)"]
        R1[user_repository]
        R2[llm_key_repository]
        R3[project_repository]
        R4[document_repository]
        R5[chunk_repository]
        R6[ga_pair_repository]
        R7[question_repository]
        R8[task_repository]
    end

    subgraph Core["Core (app/core/)"]
        C1[config — Settings]
        C2[security — JWT + bcrypt]
        C3[crypto — Fernet encrypt/decrypt]
        C4[pricing — Model pricing registry]
        C5[exceptions — AppException + error codes]
        C6[database — Engine + SessionLocal]
    end

    API --> Services
    API --> Repos
    Services --> Repos
    Services --> Core
    Repos --> Models["models.py<br/>(15 tables)"]
```

### Request Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant I as Axios Interceptor
    participant A as FastAPI Route
    participant D as Dependency (get_current_user)
    participant S as Service Layer
    participant R as Repository
    participant DB as PostgreSQL

    C->>I: HTTP Request
    I->>I: Attach Bearer token from localStorage
    I->>A: Forward request
    A->>D: Decode JWT, load user
    D->>DB: SELECT user by id
    D-->>A: User object
    A->>S: Business logic call
    S->>R: Data access
    R->>DB: SQL query (soft-delete-aware)
    DB-->>R: Result
    R-->>S: Entities
    S-->>A: Response data
    A-->>C: JSON response (Pydantic-validated)
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend

    U->>F: Enter email + password
    F->>B: POST /api/v1/auth/login
    B->>B: Verify password (bcrypt)
    B->>B: Create access token (15 min)
    B->>B: Create refresh token (30 days)
    B-->>F: { access_token, refresh_token, user }
    F->>F: Store tokens in localStorage
    F->>F: Set user in AuthContext

    Note over F,B: On subsequent requests
    F->>B: Request with Bearer token
    B->>B: Decode JWT, validate

    Note over F,B: On 401 (token expired)
    F->>F: Queue failed request
    F->>B: POST /api/v1/auth/refresh
    B-->>F: New access + refresh tokens
    F->>F: Retry queued requests with new token
```

### Generation Pipeline Flow

```mermaid
graph LR
    A["📄 Upload<br/>PDF/DOCX/MD/TXT"] -->|parse| B["🧩 Chunk<br/>recursive/markdown/token"]
    B -->|generate| C["🎭 GA Pairs<br/>Genre + Audience"]
    B -->|select chunks| D["❓ Questions<br/>per chunk × GA pair"]
    C -->|select GA pairs| D
    D -->|select questions| E["✅ Answers<br/>QA / MCQ / Classification"]
    E -->|review + confirm| F["📦 Export<br/>JSON/JSONL/Alpaca/ShareGPT"]

    style A fill:#1e293b,stroke:#38bdf8,color:#f1f5f9
    style B fill:#1e293b,stroke:#38bdf8,color:#f1f5f9
    style C fill:#1e293b,stroke:#38bdf8,color:#f1f5f9
    style D fill:#1e293b,stroke:#38bdf8,color:#f1f5f9
    style E fill:#1e293b,stroke:#38bdf8,color:#f1f5f9
    style F fill:#1e293b,stroke:#22c55e,color:#f1f5f9
```

### Frontend Component Hierarchy

```mermaid
graph TD
    Root["main.tsx<br/>StrictMode + ErrorBoundary + QueryClientProvider + AuthProvider"]
    Root --> App["App.tsx<br/>AppRouter + Toaster"]
    App --> Router["AppRouter<br/>BrowserRouter + Routes"]

    Router --> Public["PublicRoute Guard"]
    Router --> Protected["ProtectedRoute Guard"]
    Router --> Landing["LandingPage /"]

    Public --> Login["LoginPage /login"]
    Public --> Register["RegisterPage /register"]

    Protected --> DL["DashboardLayout"]
    DL --> Dashboard["DashboardPage /dashboard"]
    DL --> Projects["ProjectsPage /projects"]
    DL --> CreateProject["CreateProjectPage /projects/new"]
    DL --> ProjectDetail["ProjectDetailPage /projects/:id"]
    DL --> GAPairs["GAPairsPage /projects/:id/ga-pairs"]
    DL --> Questions["QuestionsPage /projects/:id/questions"]
    DL --> DatasetReview["DatasetReviewPage /projects/:id/dataset-review"]
    DL --> Providers["ProvidersPage /providers"]
```

---

## 📂 Folder Structure

```
quick-dataset/
│
├── backend/                          # FastAPI application
│   ├── app/
│   │   ├── main.py                   # App entry: CORS, router registration, health check
│   │   ├── models.py                 # SQLAlchemy ORM — 15 tables, enums, SoftDeleteMixin
│   │   ├── schemas.py                # Pydantic v2 — auth, projects, generation config, tasks
│   │   ├── schemas_extended.py       # Pydantic v2 — docs, chunks, GA, questions, answers, exports, prompts
│   │   │
│   │   ├── api/                      # Route handlers (one file per domain)
│   │   │   ├── deps.py               # Shared dependencies: get_db, get_current_user
│   │   │   ├── auth.py               # POST register, login, refresh; GET /me
│   │   │   ├── providers.py          # LLM key CRUD + test connection
│   │   │   ├── projects.py           # Project CRUD + pipeline_progress
│   │   │   ├── documents.py          # Upload + background parsing + MD5 dedup
│   │   │   ├── chunks.py             # Generate, preview, CRUD, inline edit
│   │   │   ├── ga_pairs.py           # Generate + manual create, CRUD
│   │   │   ├── questions.py          # Generate, estimate, bulk ops, search/filters
│   │   │   ├── dataset_items.py      # Generate answers, estimate, bulk confirm/delete
│   │   │   ├── exports.py            # Create, list, download, delete (4 formats)
│   │   │   ├── prompts.py            # Get, upsert, version history, render, test
│   │   │   ├── search.py             # Cross-entity global search (GIN + ILIKE)
│   │   │   └── tasks.py              # GET /tasks/{id} — universal progress polling
│   │   │
│   │   ├── core/                     # Framework-level infrastructure
│   │   │   ├── config.py             # pydantic-settings: DATABASE_URL, JWT, CORS, encryption
│   │   │   ├── database.py           # SQLAlchemy engine + SessionLocal factory
│   │   │   ├── security.py           # bcrypt hashing, JWT encode/decode (access + refresh)
│   │   │   ├── crypto.py             # Fernet encrypt/decrypt for API keys
│   │   │   ├── pricing.py            # Model pricing registry (40+ models), cost estimation
│   │   │   └── exceptions.py         # AppException + standard error factories
│   │   │
│   │   ├── repositories/            # Data access layer — all soft-delete-aware
│   │   │   ├── user_repository.py
│   │   │   ├── llm_key_repository.py
│   │   │   ├── project_repository.py
│   │   │   ├── document_repository.py
│   │   │   ├── chunk_repository.py
│   │   │   ├── ga_pair_repository.py
│   │   │   ├── question_repository.py
│   │   │   └── task_repository.py
│   │   │
│   │   └── services/                 # Business logic
│   │       ├── parsing/              # File parsers (PDF, DOCX, MD, TXT) → markdown text
│   │       ├── chunking/             # Recursive, markdown-aware, token-based splitters
│   │       ├── generation/           # GA, question, answer generators + resolver + estimator
│   │       ├── llm/                  # Provider clients, tracked_complete, provider_factory
│   │       ├── prompts/              # Prompt versioning + template rendering
│   │       └── usage/                # Token counting + cost estimation
│   │
│   ├── alembic/                      # Database migrations
│   ├── storage/                      # Local file storage (uploads + exports)
│   ├── requirements.txt              # Python dependencies
│   ├── alembic.ini                   # Alembic configuration
│   ├── .env.example                  # Backend env template
│   └── .env                          # Local config (git-ignored)
│
├── frontend/                         # React + TypeScript application
│   ├── src/
│   │   ├── main.tsx                  # Entry: StrictMode + ErrorBoundary + QueryClient + AuthProvider
│   │   ├── App.tsx                   # AppRouter + Toaster
│   │   │
│   │   ├── api/                      # API client layer
│   │   │   ├── client.ts             # Axios instance: interceptors, token refresh queue, error normalization
│   │   │   ├── auth.ts               # Auth API: register, login, me, refresh, logout
│   │   │   ├── projects.ts           # Projects API
│   │   │   ├── providers.ts          # LLM keys API
│   │   │   ├── documents.ts          # Document upload API
│   │   │   ├── chunks.ts             # Chunks API
│   │   │   ├── ga_pairs.ts           # GA pairs API
│   │   │   ├── questions.ts          # Questions API (generate, estimate, bulk, filters)
│   │   │   ├── dataset_items.ts      # Dataset items API (generate, confirm, bulk)
│   │   │   ├── exports.ts            # Export API
│   │   │   ├── prompts.ts            # Prompt playground API
│   │   │   ├── search.ts             # Global search API
│   │   │   └── tasks.ts              # Task polling API
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                   # Design system (button, card, dialog, table, input, etc.)
│   │   │   ├── common/               # Shared (DataTable, EmptyState, ErrorState, LoadingState, etc.)
│   │   │   ├── forms/                # Form primitives with react-hook-form
│   │   │   └── layout/               # DashboardLayout
│   │   │
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx        # Auth state: user, login, register, logout, isLoading
│   │   │
│   │   ├── features/                 # Feature modules (one per domain)
│   │   │   ├── auth/                 # Login + Register pages
│   │   │   ├── projects/             # Projects list, create, detail pages
│   │   │   ├── documents/            # Document upload UI
│   │   │   ├── chunks/               # Chunk generation + review
│   │   │   ├── ga-pairs/             # GA pair management
│   │   │   ├── questions/            # Question generation + bulk review
│   │   │   ├── dataset-review/       # Answer review + confirmation
│   │   │   └── providers/            # LLM API key management
│   │   │
│   │   ├── hooks/                    # Custom hooks (useAuth, useProjects, useQuestions, etc.)
│   │   ├── layouts/                  # Page layout wrappers
│   │   ├── pages/                    # Route-level pages (Dashboard, Landing, 404)
│   │   ├── routes/                   # AppRouter, ProtectedRoute, PublicRoute
│   │   ├── types/                    # Shared TypeScript types (api.ts)
│   │   └── lib/                      # Utilities (config, token, utils, animations, toast)
│   │
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env.example
│
├── docs/                             # Architecture documentation
│   ├── prd.md                        # Product Requirements
│   ├── trd.md                        # Technical Requirements
│   ├── design.md                     # Design decisions + rationale
│   ├── schema.md                     # Database schema (generated from models)
│   ├── appflow.md                    # User journey / screen flow
│   ├── implementation.md             # Step-by-step build plan
│   ├── tracker.md                    # Build progress tracking
│   └── rules.md                      # Architectural constraints
│
├── .gitignore
└── README.md                         # ← You are here
```

---

## 📥 Installation Guide

### Prerequisites

| Tool | Version | Required | Why |
|:---|:---|:---:|:---|
| **Python** | 3.11+ | ✅ | Backend runtime |
| **Node.js** | 18+ | ✅ | Frontend build tooling |
| **pnpm** | 9+ | ✅ | Frontend package manager (used in `pnpm-lock.yaml`) |
| **PostgreSQL** | 15+ | ✅ | Primary database (or use [Neon](https://neon.tech) for free serverless) |
| **Git** | Latest | ✅ | Version control |

> [!NOTE]
> The backend falls back to SQLite if no `DATABASE_URL` is set, but **PostgreSQL is required** for GIN full-text search indexes and JSONB features that the app depends on.

### System Requirements

- At least one LLM API key from any supported provider (OpenRouter, OpenAI, Groq, or Gemini)
- Internet access for LLM API calls during generation

---

## ⚡ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Mukassir-Ahmed-Farooqui/quick-dataset.git
cd quick-dataset
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Backend Environment

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg2://user:password@host/database?sslmode=require
JWT_SECRET_KEY=your-random-secret-key
ENCRYPTION_SECRET_KEY=your-fernet-key
```

Generate a Fernet encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 4. Initialize the Database

```bash
alembic upgrade head
```

### 5. Start the Backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> The API is now live at `http://localhost:8000`
> Interactive docs at `http://localhost:8000/docs`

### 6. Frontend Setup

```bash
# Open a new terminal
cd frontend

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
```

### 7. Start the Frontend

```bash
pnpm dev
```

> The app is now live at `http://localhost:5173` 🎉

### 8. Build for Production

```bash
# Frontend
cd frontend
pnpm build
pnpm preview    # Preview production build locally
```

---

## 🔧 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description | Example |
|:---|:---:|:---|:---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql+psycopg2://user:pass@host/db?sslmode=require` |
| `JWT_SECRET_KEY` | ✅ | Secret key for JWT token signing | Random 32+ character string |
| `JWT_ALGORITHM` | ❌ | JWT algorithm (default: `HS256`) | `HS256` |
| `ENCRYPTION_SECRET_KEY` | ✅ | Fernet key for API key encryption | Generate with `Fernet.generate_key()` |

### Frontend (`frontend/.env`)

| Variable | Required | Description | Example |
|:---|:---:|:---|:---|
| `VITE_API_BASE_URL` | ✅ | Backend API base URL | `http://localhost:8000/api/v1` |

> [!WARNING]
> Never commit `.env` files to version control. Only `.env.example` files are tracked.

---

## ⚙️ Configuration

### Backend Configuration (`app/core/config.py`)

| Setting | Default | Description |
|:---|:---|:---|
| `PROJECT_NAME` | `"Quick Dataset"` | Application display name |
| `DATABASE_URL` | `sqlite:///./test.db` | Database connection (override with env) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | JWT refresh token lifetime |
| `CORS_ORIGINS` | `["http://localhost:5173", "http://127.0.0.1:5173"]` | Allowed CORS origins |

### Frontend Configuration (`vite.config.ts`)

| Setting | Value | Description |
|:---|:---|:---|
| Path alias `@` | `./src` | Enables `@/components/...` imports |
| React plugin | `@vitejs/plugin-react` | HMR and JSX transform |

### TanStack Query Defaults (`main.tsx`)

| Setting | Value | Description |
|:---|:---|:---|
| `staleTime` | 5 minutes | Cached data considered fresh for 5 min |
| `retry` | 1 | Retry failed queries once |

### Tailwind Theme (`tailwind.config.js`)

- Custom CSS variable-based color tokens: `canvas`, `ink`, `muted`, `action`, `coral`, `success`, `error`, `warning`
- Font families: **Inter** (sans), **JetBrains Mono** (mono)
- Custom border radius scale: `xs` (4px) through `pill` (9999px)
- Dark mode support via `class` strategy

---

## 🔄 Development Workflow

### Starting Development

```bash
# Terminal 1 — Backend (auto-reloads on file changes)
cd backend
venv\Scripts\activate        # or: source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend (HMR via Vite)
cd frontend
pnpm dev
```

### Building

```bash
# Frontend production build
cd frontend
pnpm build       # TypeScript check + Vite build → dist/
```

### Linting

```bash
# Frontend
cd frontend
pnpm lint        # ESLint with React Hooks + React Refresh plugins
```

### Database Migrations

```bash
cd backend

# Create a new migration after changing models.py
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

### Testing

> [!IMPORTANT]
> **No automated test suite is currently implemented.** The `test_scripts/` directories in both `backend/` and `frontend/` contain ad-hoc test scripts for manual verification, not a formal test framework.

---

## 🚶 Application Flow

A user's journey through Quick Dataset follows this step-by-step flow:

### Phase 1 — Account Setup
1. **Register** with username, email, and password (validated: min 8 chars, must include letter + number)
2. After registration, **auto-login** via token response
3. **Add an LLM API Key** in the Providers page — pick provider (OpenRouter/OpenAI/Groq/Gemini), paste key, test connection
4. **Create a Project** with name, description, and optional default LLM key

### Phase 2 — Content Ingestion
5. **Upload documents** (PDF, DOCX, MD, TXT) — drag-and-drop, MD5 dedup, background parsing
6. **Generate chunks** — choose strategy (recursive/markdown/token), tune size/overlap, preview before committing
7. **Review chunks** — filter by document, edit inline, check token counts

### Phase 3 — Generation Pipeline
8. **Generate GA pairs** per document — or create them manually for precise control
9. **Generate questions** — select chunks × GA pairs, see live cost estimate, submit generation
10. **Review questions** — bulk select, inline edit, filter by status/chunk/GA pair/generation run/search
11. **Generate answers** — select reviewed questions, choose dataset type (QA/MCQ/Classification), see cost estimate

### Phase 4 — Review and Export
12. **Review dataset items** — bulk confirm/delete, filter by confirmed/score/type/generation run
13. **Export** — choose format (JSON/JSONL/Alpaca/ShareGPT), apply filters, download

---

## 📡 API Documentation

All endpoints are prefixed with `/api/v1`. Interactive Swagger docs are available at `http://localhost:8000/docs` when the server is running.

### Auth

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/auth/register` | Create account | ❌ |
| `POST` | `/auth/login` | Get access + refresh tokens | ❌ |
| `POST` | `/auth/refresh` | Refresh access token | ❌ |
| `GET` | `/auth/me` | Get current user profile | ✅ |

### Providers (LLM Keys)

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/providers` | Add API key | ✅ |
| `GET` | `/providers` | List API keys (masked) | ✅ |
| `PATCH` | `/providers/{key_id}` | Update key name/value/default | ✅ |
| `DELETE` | `/providers/{key_id}` | Delete API key | ✅ |
| `POST` | `/providers/{key_id}/test` | Test connection to provider | ✅ |

### Projects

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/projects` | Create project | ✅ |
| `GET` | `/projects` | List projects (with counts) | ✅ |
| `GET` | `/projects/{id}` | Get project detail + pipeline_progress | ✅ |
| `PATCH` | `/projects/{id}` | Update project | ✅ |
| `DELETE` | `/projects/{id}` | Soft-delete project | ✅ |

### Documents

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/projects/{id}/documents` | Upload files (multipart) | ✅ |
| `GET` | `/projects/{id}/documents` | List documents with status | ✅ |
| `DELETE` | `/projects/{id}/documents/{doc_id}` | Soft-delete document | ✅ |

### Chunks

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/projects/{id}/chunks/preview` | Preview chunks (not persisted) | ✅ |
| `POST` | `/projects/{id}/chunks/generate` | Generate chunks (background task) | ✅ |
| `GET` | `/projects/{id}/chunks` | List chunks (filterable) | ✅ |
| `PATCH` | `/projects/{id}/chunks/{chunk_id}` | Edit chunk content | ✅ |
| `DELETE` | `/projects/{id}/chunks/{chunk_id}` | Soft-delete chunk | ✅ |

### GA Pairs

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/projects/{id}/ga-pairs/generate` | Generate GA pairs via LLM | ✅ |
| `POST` | `/projects/{id}/ga-pairs` | Create GA pair manually | ✅ |
| `GET` | `/projects/{id}/ga-pairs` | List GA pairs | ✅ |
| `PATCH` | `/projects/{id}/ga-pairs/{pair_id}` | Update GA pair | ✅ |
| `DELETE` | `/projects/{id}/ga-pairs/{pair_id}` | Delete GA pair | ✅ |

### Questions

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/projects/{id}/questions/generate` | Generate questions (background) | ✅ |
| `POST` | `/projects/{id}/questions/estimate` | Estimate cost without generating | ✅ |
| `POST` | `/projects/{id}/questions` | Create question manually | ✅ |
| `GET` | `/projects/{id}/questions` | List with filters (status, chunk, GA pair, search) | ✅ |
| `PATCH` | `/projects/{id}/questions/{q_id}` | Update question text | ✅ |
| `POST` | `/projects/{id}/questions/bulk-delete` | Bulk delete (up to 500) | ✅ |
| `DELETE` | `/projects/{id}/questions/{q_id}` | Soft-delete question | ✅ |

### Dataset Items (Answers)

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/projects/{id}/dataset-items/generate` | Generate answers (background) | ✅ |
| `POST` | `/projects/{id}/dataset-items/estimate` | Estimate answer generation cost | ✅ |
| `GET` | `/projects/{id}/dataset-items` | List with filters (confirmed, score, type) | ✅ |
| `PATCH` | `/projects/{id}/dataset-items/{item_id}` | Update payload/cot/confirmed | ✅ |
| `POST` | `/projects/{id}/dataset-items/bulk-confirm` | Bulk confirm/unconfirm (up to 2000) | ✅ |
| `POST` | `/projects/{id}/dataset-items/bulk-delete` | Bulk delete (up to 2000) | ✅ |

### Exports

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `POST` | `/projects/{id}/exports` | Create export (background) | ✅ |
| `GET` | `/projects/{id}/exports` | List export history | ✅ |
| `GET` | `/projects/{id}/exports/{export_id}/download` | Download export file | ✅ |
| `DELETE` | `/projects/{id}/exports/{export_id}` | Soft-delete export | ✅ |

### Prompts

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `GET` | `/projects/{id}/prompts/{type}` | Get active prompt for type | ✅ |
| `PUT` | `/projects/{id}/prompts/{type}` | Upsert prompt (creates new version) | ✅ |
| `GET` | `/projects/{id}/prompts/{type}/versions` | List version history | ✅ |
| `POST` | `/projects/{id}/prompts/render` | Render template (no LLM call) | ✅ |
| `POST` | `/projects/{id}/prompts/test` | Test prompt with real LLM call | ✅ |

### Search & Tasks

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---:|
| `GET` | `/projects/{id}/search?q=...` | Cross-entity search | ✅ |
| `GET` | `/tasks/{task_id}` | Poll task progress | ✅ |
| `GET` | `/health` | Health check | ❌ |

### Response Patterns

<details>
<summary><strong>📦 Pagination Envelope</strong> (every list endpoint)</summary>

```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_items": 142,
    "total_pages": 3,
    "has_next": true,
    "has_previous": false
  }
}
```
</details>

<details>
<summary><strong>❌ Error Response</strong> (every error)</summary>

```json
{
  "detail": "Entity has downstream data — use ?force=true to confirm",
  "code": "HAS_DOWNSTREAM_DATA"
}
```
</details>

<details>
<summary><strong>📋 Task Accepted Response</strong> (every generation endpoint)</summary>

```json
{
  "task_id": "uuid",
  "generation_run_id": "uuid"
}
```
HTTP Status: `202 Accepted`
</details>

---

## 🗄️ Database

### Overview

- **Engine**: PostgreSQL (15+) via Neon (serverless) or local
- **ORM**: SQLAlchemy with declarative base
- **Migrations**: Alembic (autogenerated from `models.py`)
- **Tables**: 15 total
- **Soft Deletes**: Applied to 7 tables via `SoftDeleteMixin`
- **Full-Text Search**: GIN indexes on `chunks.content` and `questions.question` via `to_tsvector`

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ user_llm_keys : has
    users ||--o{ projects : owns

    projects ||--o{ documents : contains
    projects ||--o{ ga_pairs : contains
    projects ||--o{ generation_runs : tracks
    projects ||--o{ tasks : runs
    projects ||--o{ llm_usage_logs : records
    projects ||--o{ exports : produces
    projects ||--o{ custom_prompts : customizes

    documents ||--o{ chunks : split_into
    chunks ||--o{ questions : generates
    ga_pairs ||--o{ questions : influences

    generation_runs ||--o{ questions : produces
    generation_runs ||--o{ dataset_items : produces
    generation_runs ||--o{ conversations : produces
    generation_runs ||--o{ tasks : tracked_by

    questions ||--o{ dataset_items : answered_by
    questions ||--o{ conversations : expanded_into

    users {
        uuid id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        datetime created_at
    }

    projects {
        uuid id PK
        uuid owner_id FK
        uuid default_llm_key_id FK
        varchar name
        varchar status
        datetime deleted_at
    }

    documents {
        uuid id PK
        uuid project_id FK
        varchar filename
        varchar file_type
        varchar processing_status
        varchar md5
        datetime deleted_at
    }

    chunks {
        uuid id PK
        uuid document_id FK
        integer chunk_index
        text content
        integer token_count
        datetime deleted_at
    }

    questions {
        uuid id PK
        uuid chunk_id FK
        uuid ga_pair_id FK
        uuid generation_run_id FK
        text question
        boolean answered
        datetime deleted_at
    }

    dataset_items {
        uuid id PK
        uuid question_id FK
        uuid generation_run_id FK
        varchar dataset_type
        jsonb payload
        float score
        boolean confirmed
        datetime deleted_at
    }

    generation_runs {
        uuid id PK
        uuid project_id FK
        varchar run_type
        varchar model_name
        integer prompt_version
        varchar status
    }
```

### Key Schema Decisions

| Decision | Rationale |
|:---|:---|
| **JSONB `payload` on `dataset_items`** | QA, MCQ, and Classification have different shapes. JSONB avoids a wide table of nulls. New dataset types need a code change, not a migration. |
| **`generation_runs` as its own table** | Captures model + prompt version per batch. Enables tracing why any batch came out wrong. |
| **Append-only `custom_prompts`** | Prevents mutation of historical prompt pointers in `generation_runs.prompt_version`. |
| **Denormalized `source_document_id` / `source_chunk_id` on `dataset_items`** | Avoids a 4-table join on every "which document produced this" query. Written once at generation time. |
| **Soft deletes (7 tables)** | `projects`, `documents`, `chunks`, `questions`, `dataset_items`, `conversations`, `exports` — all use `deleted_at`. Queries must filter `WHERE deleted_at IS NULL` at the repository layer. |

---

## 🔐 Security

| Layer | Implementation | Details |
|:---|:---|:---|
| **Authentication** | JWT (HS256) | 15-min access tokens + 30-day refresh tokens via `python-jose` |
| **Password Storage** | bcrypt | Hashed via `passlib.context.CryptContext`. Never logged, never returned. |
| **API Key Encryption** | Fernet (AES-256) | Keys encrypted at rest via `cryptography.fernet`. Only masked previews in API responses. |
| **Token Refresh** | Automatic queue | Frontend queues requests on 401, refreshes token, retries — transparent to user |
| **Input Validation** | Pydantic v2 | Every endpoint uses typed models. No raw dict I/O. |
| **Password Rules** | Server-enforced | Min 8 chars, must contain letter + number (Pydantic `field_validator`) |
| **CORS** | Configurable | Default allows `localhost:5173` only |
| **Soft Deletes** | `SoftDeleteMixin` | Accidental deletes are reversible. Hard delete is a planned future cleanup task. |
| **Downstream Protection** | `409 HAS_DOWNSTREAM_DATA` | Deleting an entity with dependencies requires `?force=true` |

> [!CAUTION]
> **Known risk**: JWT tokens are stored in `localStorage` on the frontend, which is vulnerable to XSS attacks. This is a deliberate v1 tradeoff for simplicity. A production deployment should consider `httpOnly` cookies.

---

## ⚡ Performance

### Backend Optimizations
- **Batch aggregate queries** — Project list computes doc/question/item counts in 3 queries total (not N+1 per project)
- **GIN indexes** — Full-text search on `chunks.content` and `questions.question` via `to_tsvector` for sub-linear search
- **Connection pooling** — SQLAlchemy engine with `pool_pre_ping=True` for connection health checks
- **Background tasks** — All generation operations run async via `BackgroundTasks`, returning 202 immediately
- **LLM call timeout** — Hard 90-second wall-clock timeout on every provider call via `asyncio.wait_for`

### Frontend Optimizations
- **Lazy loading** — All page components loaded via `React.lazy()` + `Suspense` for code splitting
- **TanStack Query caching** — 5-minute stale time reduces redundant API calls; single retry on failure
- **Axios request queue** — On token expiry, concurrent requests are queued and replayed after refresh — no duplicate refresh calls
- **Design token system** — CSS variables in Tailwind config avoid redundant style computations

---

## ❌ Error Handling

### Backend

Every error in the application produces a consistent JSON response:

```json
{
  "detail": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE"
}
```

Standard error codes:
| Code | HTTP Status | Meaning |
|:---|:---:|:---|
| `RESOURCE_NOT_FOUND` | 404 | Entity doesn't exist or is soft-deleted |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `UNAUTHORIZED` | 401 | Invalid or expired JWT |
| `{ENTITY}_ALREADY_EXISTS` | 409 | Duplicate unique constraint violation |
| `HAS_DOWNSTREAM_DATA` | 409 | Delete blocked — entity has dependent children |
| `TASK_ALREADY_COMPLETED` | 409 | Attempted operation on a finished task |
| `BAD_REQUEST` | 400 | Generic validation failure |
| `NO_LLM_KEY` | 400 | No API key resolved for generation |
| `KEY_DECRYPTION_FAILED` | 400 | Stored API key cannot be decrypted |

### Frontend

- **Axios interceptor** normalizes all error responses into `ApiError` objects with `status` and `endpoint`
- **FastAPI validation errors** (array of `{msg, loc}`) are flattened into human-readable strings
- **`GlobalErrorBoundary`** catches unhandled React errors
- **Toast notifications** (Sonner) for user-facing error/success messages

---

## 📜 Scripts

### Backend

| Command | Description |
|:---|:---|
| `uvicorn app.main:app --reload` | Start development server with hot reload |
| `alembic upgrade head` | Apply all pending migrations |
| `alembic revision --autogenerate -m "..."` | Generate migration from model changes |
| `alembic downgrade -1` | Rollback last migration |

### Frontend (`package.json`)

| Command | Description |
|:---|:---|
| `pnpm dev` | Start Vite development server with HMR |
| `pnpm build` | TypeScript check + Vite production build → `dist/` |
| `pnpm lint` | Run ESLint (react-hooks + react-refresh plugins) |
| `pnpm preview` | Preview production build locally |

---

## 🚀 Deployment

### Backend

The backend is a standard **ASGI application** deployable to any platform that supports Python:

| Platform | Notes |
|:---|:---|
| **Render** | Add `uvicorn app.main:app --host 0.0.0.0 --port $PORT` as start command |
| **Railway** | Auto-detects Python, set `DATABASE_URL` and other env vars |
| **Fly.io** | Use a `Dockerfile` or `fly.toml` with uvicorn |

Required environment variables for production: `DATABASE_URL`, `JWT_SECRET_KEY`, `ENCRYPTION_SECRET_KEY`

### Frontend

The frontend is a standard **Vite/React static build** deployable to any static hosting:

| Platform | Notes |
|:---|:---|
| **Vercel** | Zero-config: auto-detects Vite, set `VITE_API_BASE_URL` as env var |
| **Netlify** | Build command: `pnpm build`, publish dir: `dist/` |
| **Cloudflare Pages** | Same as Netlify |

### Infrastructure

| Service | Current (v1) | Production |
|:---|:---|:---|
| **Database** | PostgreSQL via Neon (serverless) | Same — Neon scales automatically |
| **File Storage** | Local `storage/` directory | Cloudflare R2 with presigned URLs |
| **Background Jobs** | FastAPI `BackgroundTasks` | Celery + Redis (planned) |

---

## 🧪 Testing

> [!IMPORTANT]
> **No automated test suite exists.** There is no test framework configured, no unit tests, and no integration tests. The `test_scripts/` directories in both `backend/` and `frontend/` contain ad-hoc manual verification scripts, not automated tests.
>
> Adding a proper test suite (pytest for backend, Vitest for frontend) is on the future roadmap.

---

## ⚠️ Limitations

These are **intentional v1 scope cuts** with documented upgrade paths, not bugs.

| Limitation | Why It's Acceptable | Upgrade Path |
|:---|:---|:---|
| **In-process background tasks** | `BackgroundTasks` — tasks lost on server restart | Celery + Redis for durable task execution |
| **No team/workspace support** | Single-owner projects only | Teams, workspaces, RBAC |
| **Token estimation is approximate** | Uses `tiktoken` (OpenAI tokenizer) for all providers | Per-provider tokenizer adapters |
| **No image dataset support** | Text-only: QA, MCQ, Classification | Vision model support, image-text datasets |
| **No external monitoring** | Relies on `llm_usage_logs`, `tasks.error_log`, `generation_runs` | Structured logging, Sentry, APM |
| **No billing/subscriptions** | BYOK only — users pay LLM providers directly | Stripe integration |
| **No i18n** | English-only UI | Internationalization framework |
| **Local file storage** | Uploads/exports stored in `backend/storage/` | Cloudflare R2 with presigned URLs |
| **No automated tests** | Manual verification only | pytest (backend) + Vitest (frontend) |
| **JWT in localStorage** | Vulnerable to XSS | `httpOnly` secure cookies |
| **No rate limiting** | API endpoints are unthrottled | Express-rate-limit or FastAPI middleware |
| **No email verification** | Registration doesn't verify email | Email confirmation flow |

---

## 🔮 Future Roadmap

### 🟢 Near-Term (Post-MVP Polish)

- [ ] **AI Evaluation** — Judge-model scoring with quality distribution histograms (`EvaluateRequest` schema exists)
- [ ] **Multi-turn Conversations** — Generate dialogues with configurable roles and turns (`ConversationGenerateRequest` schema exists)
- [ ] **Chain-of-Thought Synthesis** — Generate/optimize reasoning chains with before/after diffs (`CotSynthesizeRequest` schema exists)
- [ ] **Usage Dashboard** — Cost breakdown by provider, model, and task type (`UsageSummary` schema exists)
- [ ] **Automated Test Suite** — pytest for backend, Vitest for frontend

### 🟡 Medium-Term (v2)

- [ ] **Teams & Workspaces** — Shared projects with role-based access control
- [ ] **Celery + Redis** — Durable background task execution with retries
- [ ] **Cloudflare R2 Storage** — Presigned URLs for uploads and exports
- [ ] **Model Registry** — Track and compare model performance across runs
- [ ] **Advanced Export Filters** — Score threshold, date range, custom queries

### 🔴 Long-Term (v3+)

- [ ] **Image + Multimodal Datasets** — Vision model support
- [ ] **LlamaFactory Integration** — One-click fine-tuning from exported datasets
- [ ] **Desktop App (Electron)** — Offline-first dataset creation
- [ ] **Plugin System** — Custom parsers, chunking strategies, export formats
- [ ] **Internationalization (i18n)** — Multi-language interface

---

## 🤝 Contributing

### Getting Started

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Commit changes**: `git commit -m "feat: description of change"`
4. **Push**: `git push origin feature/your-feature-name`
5. **Open a Pull Request**

### Coding Standards

#### Backend
- **Repository pattern** — All data access lives in `repositories/`, business logic in `services/`
- **Typed Pydantic models** — No endpoint accepts or returns a bare `dict`
- **Soft deletes enforced at repository layer** — Every query must filter `WHERE deleted_at IS NULL`
- **`resolve_llm_config()` before any LLM call** — Never read raw key IDs directly
- **`tracked_complete()` for every LLM call** — Never call a provider client directly
- **Every generation endpoint must have a paired `/estimate`**
- **Prompt edits are append-only** — `upsert_prompt()` inserts new rows, never mutates

#### Frontend
- **Feature-based structure** — One directory per domain under `features/`
- **Custom hooks** for data fetching (`useProjects`, `useQuestions`, etc.)
- **TanStack Query** for server state — no manual `useEffect` fetching
- **Zod + react-hook-form** for form validation
- **Path alias `@/`** for all imports

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add export format selection UI
fix: prevent duplicate document upload
docs: update API endpoint table
refactor: extract tracked_complete into shared module
```

---

## 📄 License

No license file was detected in this repository. Contact the repository owner for usage terms.

---

## ❓ FAQ

<details>
<summary><strong>What LLM providers are supported?</strong></summary>

Four providers: **OpenRouter**, **OpenAI**, **Groq**, and **Gemini**. All use BYOK — you supply your own API key. OpenRouter gives access to many models (Claude, Llama, Mistral, etc.) through a single key.
</details>

<details>
<summary><strong>Is my API key safe?</strong></summary>

Yes. API keys are encrypted at rest using Fernet (AES-256) and never appear in any API response. Only a masked preview (e.g., `sk-...ab12`) is shown.
</details>

<details>
<summary><strong>What happens if the server restarts during a generation task?</strong></summary>

In v1, tasks run in-process via FastAPI `BackgroundTasks` and are lost on restart. The `tasks` table still records the last known state. Celery + Redis is the planned upgrade for durable tasks.
</details>

<details>
<summary><strong>What export formats are supported?</strong></summary>

Four formats: **JSON** (array of payload objects), **JSONL** (one JSON object per line), **Alpaca** (`instruction/input/output`), and **ShareGPT** (`conversations` with `from`/`value` pairs).
</details>

<details>
<summary><strong>Can I use this without PostgreSQL?</strong></summary>

The config falls back to SQLite, but full-text search (GIN indexes), JSONB payload queries, and some constraint types require PostgreSQL. Use [Neon](https://neon.tech) for a free serverless PostgreSQL instance.
</details>

<details>
<summary><strong>What's the difference between "Render Preview" and "Test with LLM" in the Prompt Playground?</strong></summary>

**Render Preview** does free string substitution — it replaces `{{variables}}` with sample values instantly, no LLM call, no cost. **Test with LLM** actually fires the rendered prompt at a real model and shows the output — this costs tokens.
</details>

<details>
<summary><strong>What does "Genre/Audience pair" mean?</strong></summary>

GA pairs diversify the questions generated from the same chunk. For example, the same technical document chunk produces very different questions when targeted at "Genre: FAQ, Audience: beginners" versus "Genre: troubleshooting guide, Audience: senior engineers."
</details>

<details>
<summary><strong>How accurate are the cost estimates?</strong></summary>

Estimates use `tiktoken` (OpenAI's cl100k_base tokenizer) for all providers, which is approximate for non-OpenAI models. The estimate is advisory — actual costs come from the provider's billing. The pricing engine covers 40+ models with provider-level fallback for unknown models.
</details>

---

## 🔧 Troubleshooting

<details>
<summary><strong>Backend won't start: <code>ModuleNotFoundError</code></strong></summary>

Ensure your virtual environment is activated and dependencies are installed:
```bash
cd backend
venv\Scripts\activate       # Windows
source venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
```
</details>

<details>
<summary><strong><code>alembic upgrade head</code> fails with connection error</strong></summary>

Check your `DATABASE_URL` in `backend/.env`. For Neon, ensure `?sslmode=require` is appended. For local PostgreSQL, ensure the server is running and the database exists.
</details>

<details>
<summary><strong>Frontend shows blank page or "VITE_API_BASE_URL is undefined"</strong></summary>

Ensure `frontend/.env` exists and contains:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```
Restart the Vite dev server after creating/editing `.env`.
</details>

<details>
<summary><strong>CORS errors in browser console</strong></summary>

The backend allows `http://localhost:5173` and `http://127.0.0.1:5173` by default. If your frontend runs on a different port or domain, update `CORS_ORIGINS` in `backend/app/core/config.py`.
</details>

<details>
<summary><strong>API key test connection fails</strong></summary>

1. Verify the key is correct and not expired
2. Check that you selected the right provider (OpenRouter key won't work with OpenAI provider)
3. Ensure you have internet access for the provider's API
4. Check the backend logs for the specific error message
</details>

<details>
<summary><strong><code>ENCRYPTION_SECRET_KEY</code> error on startup</strong></summary>

Generate a valid Fernet key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Paste the output as `ENCRYPTION_SECRET_KEY` in `backend/.env`. The key must be a valid URL-safe base64-encoded 32-byte string.
</details>

<details>
<summary><strong>Generation tasks stuck in "processing" state</strong></summary>

If the server restarted during a task, the in-process task was lost. The task record in the database will still show `processing`. There is no automatic recovery in v1 — re-trigger the generation.
</details>

<details>
<summary><strong>pnpm install fails</strong></summary>

Ensure you're using pnpm 9+. The project uses `pnpm-workspace.yaml` and `pnpm-lock.yaml`:
```bash
npm install -g pnpm@latest
cd frontend
pnpm install
```
</details>

---

<div align="center">

<br/>

**Built with 🧠 by [Mukassir Ahmed Farooqui](https://github.com/Mukassir-Ahmed-Farooqui)**

*The bottleneck to fine-tuning isn't compute anymore — it's data. This fixes that.*

<br/>

</div>
