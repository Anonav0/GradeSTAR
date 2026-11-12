# GradeSTAR 🌟

> **Distributed Automated Assignment Grader**  
> A high-assurance, asynchronous online judge that securely compiles and evaluates untrusted code across isolated Docker execution sandboxes with deterministic verdicts.

---

## 1. Overview

GradeSTAR evaluates programming submissions (C++17, Python 3, Java 21) against configured test cases without blocking client requests.

When a user submits code:

1. The **Express API** validates the payload with Zod, persists the submission to **PostgreSQL**, and enqueues an evaluation job to **Redis** via **BullMQ**.
2. Independent **Worker Daemons** claim jobs, fetch problem test cases, and create an isolated, hardened **Docker container**.
3. Code is compiled and executed under strict cgroups (CPU quota, memory, swap disabled, pids-limit, network disabled, dropped Linux capabilities, and parent wall-clock timeouts).
4. The **Evaluator** normalizes output, applies deterministic verdict precedence, and persists results.
5. The **Next.js Web UI** polls submission status until a terminal verdict is reached, displaying execution time, memory usage, and diagnostics.

---

## 2. Technology Stack

- **Frontend (`apps/web`)**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend API (`apps/api`)**: Node.js, Express, TypeScript, Zod, Pino, Vitest, Supertest
- **Evaluation Worker (`apps/worker`)**: Node.js, TypeScript, Pino, Zod
- **Queue / Scheduling**: Redis 7, BullMQ (Planned: Phase 4)
- **Database**: PostgreSQL 16, Prisma ORM (Planned: Phase 2)
- **Sandbox Execution**: Docker Engine, cgroups v2, ephemeral containers (Planned: Phase 5)
- **Testing**: Vitest, Supertest, Playwright, v8 coverage

---

## 3. Implementation Status

| Milestone   | Scope                                                                                         | Status          |
| :---------- | :-------------------------------------------------------------------------------------------- | :-------------- |
| **Phase 1** | Repository Setup, Workspaces, Base Configurations, API & Worker Skeletons, Dev Infrastructure | **Complete** ✅ |
| **Phase 2** | Database & Domain Models (PostgreSQL + Prisma)                                                | Planned ⏳      |
| **Phase 3** | Core REST API (Problems, Submissions, Validation, Errors)                                     | Planned ⏳      |
| **Phase 4** | Distributed Queue & Worker Processing (Redis + BullMQ)                                        | Planned ⏳      |
| **Phase 5** | Evaluation Engine & Isolated Docker Execution Sandboxes                                       | Planned ⏳      |
| **Phase 6** | Frontend Web Application (Problem Catalog, Monaco Editor, Polling)                            | Planned ⏳      |
| **Phase 7** | End-to-End Testing, Security Hardening, Benchmarking & Release                                | Planned ⏳      |

---

## 4. Prerequisites

- **Node.js**: `v20.x` or higher (LTS recommended)
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: Optional for Phase 1 app testing; required for local PostgreSQL & Redis infrastructure.

---

## 5. Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/gradestar.git
cd gradestar
npm install
```

### 2. Environment Setup

Copy the example environment configuration to `.env`:

```bash
cp .env.example .env
```

Review the values in `.env`:

```ini
NODE_ENV=development
API_PORT=4000
WEB_PORT=3000
LOG_LEVEL=info
DATABASE_URL=postgresql://gradestar:gradestar_dev_secret@localhost:5432/gradestar?schema=public
REDIS_URL=redis://localhost:6379
```

### 3. Start Local Infrastructure (Docker Compose)

Start PostgreSQL and Redis in the background:

```bash
npm run infra:up
# or: docker compose up -d
```

Verify service health:

```bash
docker compose ps
```

To stop infrastructure:

```bash
npm run infra:down
```

---

## 6. Development & Run Commands

You can run individual services or check the entire monorepo:

### Running Services

```bash
# Run API in development watch mode (port 4000)
npm run dev:api

# Run Worker daemon in development watch mode
npm run dev:worker

# Run Next.js Web frontend (port 3000)
npm run dev:web
```

### Building Packages & Applications

```bash
# Build all packages and applications
npm run build
```

### Linting & Formatting

```bash
# Check code style with Prettier
npm run format:check

# Auto-fix formatting
npm run format

# Run ESLint across monorepo
npm run lint

# Type-check all workspaces
npm run typecheck
```

### Running Tests & Coverage

```bash
# Run all unit and integration tests
npm run test

# Run tests with coverage reports
npm run test:coverage
```

---

## 7. API Verification (Phase 1 Endpoints)

While `apps/api` is running on port 4000:

### Liveness Probe

```bash
curl -i http://localhost:4000/health
```

Response (`200 OK`):

```json
{
  "status": "ok",
  "timestamp": "2026-11-12T14:20:00.000Z",
  "uptimeSeconds": 42,
  "service": "gradestar-api",
  "environment": "development"
}
```

### Readiness Probe

```bash
curl -i http://localhost:4000/ready
```

Response (`200 OK`):

```json
{
  "status": "ready",
  "timestamp": "2026-11-12T14:20:00.000Z",
  "service": "gradestar-api",
  "checks": {
    "process": {
      "status": "ok",
      "message": "API process is initialized and ready to accept HTTP traffic"
    },
    "postgres": {
      "status": "not_implemented",
      "message": "Database persistence layer is planned for Phase 2"
    },
    "redis": {
      "status": "not_implemented",
      "message": "Redis queue connection is planned for Phase 4"
    }
  }
}
```

---

## 8. License

Internal and Portfolio Evaluation License. Built with strict software engineering standards.
