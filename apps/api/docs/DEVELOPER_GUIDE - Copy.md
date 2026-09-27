# Developer Guide — Tavonza AI Platform

> **Welcome to the team!** This guide walks every developer through the full workflow: cloning the repo, writing code, branching, installing packages, running the dev server, testing, and finally pushing your changes and opening a Pull Request.
>
> There are role-specific sections for **Frontend**, **Backend**, and **AI** engineers. Read the universal sections first, then jump to your role's section.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Cloning the Repository](#2-cloning-the-repository)
3. [Environment Setup](#3-environment-setup)
4. [Installing Dependencies](#4-installing-dependencies)
5. [Monorepo Structure Overview](#5-monorepo-structure-overview)
6. [Branching Strategy](#6-branching-strategy)
7. [Running the Development Server](#7-running-the-development-server)
8. [Writing Code — Universal Rules](#8-writing-code--universal-rules)
9. [Role Guide: Frontend Developer](#9-role-guide-frontend-developer)
10. [Role Guide: Backend Developer](#10-role-guide-backend-developer)
11. [Role Guide: AI Developer](#11-role-guide-ai-developer)
12. [Installing New Packages](#12-installing-new-packages)
13. [Testing](#13-testing)
14. [Linting & Type Checking](#14-linting--type-checking)
15. [Pushing Your Changes](#15-pushing-your-changes)
16. [Opening a Pull Request](#16-opening-a-pull-request)
17. [CI/CD Pipeline](#17-cicd-pipeline)
18. [Common Pitfalls & FAQ](#18-common-pitfalls--faq)

---

## 1. Prerequisites

Before you start, make sure the following tools are installed on your machine.

| Tool                        | Minimum Version | Install                                              |
| --------------------------- | --------------- | ---------------------------------------------------- |
| **Node.js**                 | `>= 20.0.0`     | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| **pnpm**                    | `>= 9.0.0`      | `npm install -g pnpm@9`                              |
| **Docker & Docker Compose** | Latest stable   | [docker.com](https://www.docker.com/get-started)     |
| **Git**                     | Latest stable   | [git-scm.com](https://git-scm.com)                   |

Verify your setup:

```bash
node --version    # should print v20.x.x or later
pnpm --version    # should print 9.x.x or later
docker --version  # should print Docker version 24.x or later
git --version     # should print git version 2.x or later
```

> **Why pnpm?** This monorepo uses **pnpm workspaces** to manage dependencies across all apps and packages. Do not use `npm` or `yarn` — doing so will corrupt the lockfile and break CI.

---

## 2. Cloning the Repository

```bash
# Clone via SSH (recommended — requires your SSH key added to GitHub)
git clone git@github.com:tavonzaai/tavonzaai.git

# Or clone via HTTPS
git clone https://github.com/tavonzaai/tavonzaai.git

# Navigate into the project
cd tavonzaai
```

---

## 3. Environment Setup

The project uses `.env` files at the **monorepo root** as well as per-app `.env` files where needed.

```bash
# Copy the example env file to create your local .env
cp .env.example .env
```

Open `.env` and fill in the required values. Ask a team lead for any secrets you don't have access to.

> **Never commit `.env` to git.** It is already listed in `.gitignore`. Commit only `.env.example` (with dummy/placeholder values) when adding new environment variables.

---

## 4. Installing Dependencies

Run this **once** from the monorepo root after cloning (and again whenever `pnpm-lock.yaml` changes):

```bash
pnpm install
```

This installs dependencies for **all** apps and packages in the workspace simultaneously. You do not need to `cd` into each directory.

---

## 5. Monorepo Structure Overview

```text
tavonzaai/
├── apps/
│   ├── api/          # NestJS REST API & domain orchestration  (port 3000)
│   ├── realtime/     # WebSocket gateway & presence            (port 3001)
│   ├── worker/       # Background queue workers & scheduled jobs
│   └── ai/           # AI agent runtime & Tool Gateway
│
├── packages/         # Shared internal libraries (@tavonza/*)
│   ├── authorization/  # Capability & scope models
│   ├── contracts/      # Cross-domain DTOs & API specs
│   ├── database/       # DB connection & migrations
│   ├── events/         # Domain events & outbox schemas
│   ├── observability/  # Logging, metrics, tracing
│   ├── queue/          # Queue interfaces (SQS)
│   ├── storage/        # Object storage abstractions (S3)
│   ├── config/         # Environment schema validation
│   └── shared/         # Pure domain-agnostic utilities
│
├── frontend/
│   ├── customer/     # QR-driven ordering experience          (port 3100)
│   ├── staff/        # Operational staff app                  (port 3101)
│   └── admin/        # Tenant & branch admin console          (port 3102)
│
├── infra/            # Terraform infrastructure code
├── docs/             # Documentation & runbooks
├── docker/           # Dockerfiles & docker-compose
├── scripts/          # Developer automation scripts
└── .agent/           # Architectural source of truth & ADRs
```

**Package naming convention:** All internal packages are prefixed `@tavonza/*` (e.g., `@tavonza/contracts`, `@tavonza/shared`). When referencing them in `package.json`, use the workspace protocol:

```json
"@tavonza/contracts": "workspace:*"
```

---

## 6. Branching Strategy

We use a **3-tier protected branch model**. Code flows in one direction only:

```
Your branch  →  dev  →  prod  →  main
   (PR)       (review) (staging) (live)
```

### The Three Protected Branches

> These branches are **protected** — no one pushes directly to them. All changes go through a PR.

| Branch | Environment                           | Purpose                                                                                                            |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `main` | 🟢 **Production** (live)              | The actual platform users interact with. Only fully battle-tested code from `prod` ever lands here.                |
| `prod` | 🟡 **Pre-Production** (staging)       | Fully QA'd and stress-tested before promotion to `main`. Acts as the final safety net.                             |
| `dev`  | 🔵 **Development** (team integration) | Where all developer PRs land. The tech lead reviews and merges here. All automated CI runs on PRs targeting `dev`. |

### Developer Branches (your working branch)

You always create your branch from `dev`, work on it, then open a PR **back to `dev`**. You never target `prod` or `main` directly.

| Branch pattern                          | Purpose                                                               |
| --------------------------------------- | --------------------------------------------------------------------- |
| `feature/<ticket-id>-short-description` | New features                                                          |
| `fix/<ticket-id>-short-description`     | Bug fixes                                                             |
| `chore/<description>`                   | Tooling, config, dependency updates, docs                             |
| `refactor/<description>`                | Code restructuring (no behaviour change)                              |
| `hotfix/<ticket-id>-short-description`  | Critical production fixes (PR directly to `prod` + backport to `dev`) |

### How Code Gets to Production

```
1. You create a branch from dev
   git checkout dev && git pull origin dev
   git checkout -b feature/TAVN-123-order-cancellation

2. You write code, commit, push
   git push origin feature/TAVN-123-order-cancellation

3. You open a PR → targeting dev
   CI runs automatically (typecheck, tests)
   Tech lead reviews and merges

4. Tech lead promotes dev → prod  (PR: dev → prod)
   Pre-production environment deploys automatically
   QA / integration testing happens here

5. Tech lead promotes prod → main  (PR: prod → main)
   Production environment deploys manually by tiggering action
   🚀 Users see the changes
```

### Creating Your Branch

```bash
# Always start from dev
git checkout dev
git pull origin dev

# Create your branch
git checkout -b feature/TAVN-123-add-order-cancellation
```

### Branch Naming Rules

- Use **kebab-case** only — no spaces, no uppercase
- Always include the **ticket/issue ID** (e.g., `TAVN-123`)
- Keep the description short and meaningful
- ✅ `feature/TAVN-42-waiter-table-assignment`
- ✅ `fix/TAVN-99-cart-total-rounding-error`
- ❌ `my-changes`, `fix`, `test123`, `sabbir-branch`

---

## 7. Running the Development Server

### Run Everything (All Apps)

From the monorepo root, Turborepo orchestrates all dev servers in parallel:

```bash
pnpm dev
```

This starts all apps concurrently with their respective ports:

| App                  | URL                   |
| -------------------- | --------------------- |
| API (NestJS)         | http://localhost:3000 |
| Realtime (WebSocket) | http://localhost:3001 |
| Customer Frontend    | http://localhost:3100 |
| Staff Frontend       | http://localhost:3101 |
| Admin Frontend       | http://localhost:3102 |

### Run a Specific App Only

```bash
# Run only the API
pnpm --filter @tavonza/api dev

# Run only the admin frontend
pnpm --filter @frontend/admin dev

# Run only the AI service
pnpm --filter @tavonza/ai dev
```

### Run with Docker (Recommended for Backend)

For a more realistic environment with Postgres, Redis, and other backing services:

```bash
docker compose -f docker/docker-compose.dev.yml up
```

---

## 8. Writing Code — Universal Rules

These rules apply to **every** developer, regardless of role.

### TypeScript First

- All code is written in **TypeScript**. No `.js` files in `apps/` or `packages/`.
- The base `tsconfig.base.json` enforces strict mode. **Do not loosen it.**
- Common flags enforced: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`.

### No Cross-Domain Database Access

```
✅ Domain A communicates with Domain B via Application Services or Domain Events
❌ Domain A's repository directly queries Domain B's database tables
```

### No Direct AWS SDK Imports in Domain Code

```typescript
// ❌ Wrong — imports AWS SDK directly into domain logic
import { S3Client } from "@aws-sdk/client-s3";

// ✅ Correct — use the storage port from @tavonza/storage
import { StoragePort } from "@tavonza/storage";
```

### Commit Message Format (Conventional Commits)

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Types:**

| Type       | When to use                             |
| ---------- | --------------------------------------- |
| `feat`     | New feature                             |
| `fix`      | Bug fix                                 |
| `chore`    | Build process, tooling, deps            |
| `docs`     | Documentation only                      |
| `refactor` | Code restructuring (no behavior change) |
| `test`     | Adding or fixing tests                  |
| `perf`     | Performance improvement                 |
| `ci`       | CI/CD configuration                     |

**Examples:**

```bash
git commit -m "feat(orders): add order status update endpoint"
git commit -m "fix(auth): resolve token expiry edge case"
git commit -m "chore: bump @tavonza/contracts to 0.2.0"
git commit -m "docs: update developer guide with AI role section"
```

### Small, Focused Commits

- One logical change per commit
- Don't commit commented-out code
- Don't commit `console.log` / debug statements

---

## 9. Role Guide: Frontend Developer

### Your Apps

| App          | Path                 | Port | Audience                           |
| ------------ | -------------------- | ---- | ---------------------------------- |
| Customer App | `frontend/customer/` | 3100 | Restaurant guests (QR scan)        |
| Staff App    | `frontend/staff/`    | 3101 | Waiters, kitchen, cashier, manager |
| Admin App    | `frontend/admin/`    | 3102 | Tenant & branch admins             |

### Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** CSS Modules / Vanilla CSS (unless team decides otherwise)
- **Package scope:** `@frontend/<app-name>`

### Starting Development

```bash
# Run all frontends
pnpm dev

# Or just one
pnpm --filter @frontend/customer dev
pnpm --filter @frontend/staff dev
pnpm --filter @frontend/admin dev
```

### Using Shared Packages

Frontend apps may import from `@tavonza/contracts` and `@tavonza/shared`:

```typescript
import type { OrderDto } from "@tavonza/contracts";
import { formatCurrency } from "@tavonza/shared";
```

> **Important:** Frontend apps must NOT import from `@tavonza/database`, `@tavonza/queue`, `@tavonza/authorization`, or any server-only package.

### Authorization in Frontend

- Authorization logic lives in the **backend** — period.
- Frontend may check user roles for **UI purposes only** (e.g., hiding a button).
- Never trust frontend authorization claims as a security boundary.

```typescript
// ✅ OK — UI-only guard
if (user.role === 'manager') {
  return <ManagerPanel />;
}

// ❌ Never do this — treating a frontend check as a security boundary
if (user.role === 'admin') {
  fetchSensitiveData(); // backend MUST enforce this too
}
```

### Code Rules for Frontend

1. **Components** — Keep them small and focused. One component = one responsibility.
2. **Data fetching** — Use Server Components for initial data. Use Client Components only when you need interactivity.
3. **Types** — Import DTO types from `@tavonza/contracts`, don't redefine them locally.
4. **No inline styles** — Use CSS Modules or a shared design token system.
5. **Accessibility** — All interactive elements must have proper `aria-*` attributes and keyboard support.

---

## 10. Role Guide: Backend Developer

### Your Apps & Packages

| Path             | Purpose                              |
| ---------------- | ------------------------------------ |
| `apps/api/`      | Main NestJS REST API, domain modules |
| `apps/realtime/` | WebSocket gateway                    |
| `apps/worker/`   | Background jobs, outbox processor    |
| `packages/*`     | Shared internal libraries            |

### Tech Stack

- **Framework:** NestJS 10
- **Language:** TypeScript (CommonJS module format for NestJS)
- **Database:** PostgreSQL (via `@tavonza/database`)
- **Queue:** SQS (via `@tavonza/queue`)
- **Auth:** JWT + capability/scope model (via `@tavonza/authorization`)

### Starting Development

```bash
# Run the API in watch mode
pnpm --filter @tavonza/api dev

# Or run all backend services
pnpm dev
```

### Domain Module Structure

Each business domain lives in `apps/api/src/modules/<domain>/` and follows this layout:

```
modules/orders/
├── application/          # Use cases / application services
│   ├── commands/
│   └── queries/
├── domain/               # Entities, value objects, domain events
│   ├── entities/
│   └── events/
├── infrastructure/       # Repository implementations, adapters
│   └── repositories/
├── interface/            # Controllers, DTOs (request/response), guards
│   ├── http/
│   └── dtos/
└── orders.module.ts
```

### The Dependency Rule

Dependencies **always** flow inward:

```
Interface → Application → Domain → Infrastructure
```

- `Domain` has zero external dependencies — pure business logic only.
- `Application` orchestrates domain objects and calls infrastructure via **ports (interfaces)**.
- `Infrastructure` implements the ports.
- `Interface` (controllers) only handles HTTP concerns — it never calls repositories directly.

### Tenant Isolation

Every query that accesses tenant-scoped data **must** include the `organizationId` (and often `branchId`) as a filter. Never return data across tenant boundaries.

```typescript
// ✅ Correct — always scope by organization
async findOrders(organizationId: string, branchId: string) {
  return this.orderRepo.findAll({ organizationId, branchId });
}

// ❌ Wrong — no tenant scoping
async findOrders() {
  return this.orderRepo.findAll(); // returns data from all tenants!
}
```

### Authorization Pattern

Authorization is handled via the `@tavonza/authorization` package. Use the provided guards and decorators:

```typescript
@Get(':id')
@RequirePermission('orders:read')
@UseGuards(AuthGuard, PermissionGuard)
async getOrder(@Param('id') id: string, @Actor() actor: ActorContext) {
  return this.getOrderQuery.execute({ id, actor });
}
```

> The backend **always** re-validates permissions. Never skip authorization based on a client-supplied flag.

### Domain Events

When a significant state change occurs (e.g., order placed, payment confirmed), emit a domain event:

```typescript
import { OrderPlacedEvent } from "@tavonza/events";

// Inside your application service
this.eventBus.publish(new OrderPlacedEvent({ orderId, organizationId, items }));
```

Never call another domain's service directly — communicate via events.

### Adding a New Package

If you're creating a new shared library under `packages/`:

1. Create the directory `packages/<name>/`
2. Add `package.json` with `"name": "@tavonza/<name>"`
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Export via `index.ts`
5. Reference it in other packages using `"@tavonza/<name>": "workspace:*"`

---

## 11. Role Guide: AI Developer

### Your App

| Path       | Purpose                                                          |
| ---------- | ---------------------------------------------------------------- |
| `apps/ai/` | AI agent runtime, context builder, Tool Gateway, model services |

### Language & Framework Freedom

The AI app does **not** enforce a specific language or framework. You have full flexibility based on the task:

| Language | Common use case | Suggested tools |
|----------|----------------|------------------|
| **Python** | ML models, vector embeddings, LLM orchestration | FastAPI, LangChain, LlamaIndex, Haystack |
| **TypeScript** | Tool Gateway client, lightweight orchestration | tsx, Node.js |

> **Recommendation:** Use **Python + FastAPI** as the main AI service runtime. It gives you the richest ecosystem for LLMs, embeddings, vector stores, and ML pipelines. Use TypeScript only for lightweight gateway clients or integration glue if needed.

### Python Setup (FastAPI)

```bash
# AI service lives in apps/ai/
cd apps/ai

# Create a virtual environment (Python 3.11+)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the dev server
uvicorn main:app --reload --port 8000
```

AI service runs on **http://localhost:8000** in development.

### Python Project Structure (recommended)

```
apps/ai/
├── main.py               # FastAPI app entrypoint
├── requirements.txt      # Python dependencies
├── requirements-dev.txt  # Dev/test dependencies
├── .python-version       # Pin Python version (e.g. 3.11)
├── routers/              # FastAPI route handlers (tool endpoints)
├── services/             # Business logic (LLM calls, embeddings, etc.)
├── tools/                # Tool Gateway tool implementations
├── schemas/              # Pydantic request/response models
└── tests/                # pytest test suite
```

### Vector Store & Embedding Choices

You have full freedom here — choose what fits the task:

| Tool | Purpose |
|------|---------|
| **pgvector** | Postgres-native vector search (simplest, already in infra) |
| **Qdrant** | Dedicated vector DB (better for scale) |
| **Pinecone** | Managed cloud vector DB |
| **Chroma** | Local development, prototyping |
| **Weaviate** | Full-featured, open-source |

> Start with **pgvector** — it reuses the existing Postgres infra with zero extra services. Switch to a dedicated vector DB only if you hit performance limits.

### The Golden Rule: AI Cannot Bypass the Platform

**AI is an authorized client of the platform, not a privileged back-channel.**

- AI calls platform capabilities through the **Tool Gateway** only.
- AI **never** receives direct database access.
- AI **never** bypasses the authorization layer.
- Every AI tool call is subject to the exact same `Actor + Permission + Scope + Resource` checks as a human user action.

```python
# ✅ Correct — AI calls through the Tool Gateway (which enforces authorization)
result = await tool_gateway.invoke(
    tool="orders.getStatus",
    actor=ai_actor,
    params={"order_id": order_id},
)

# ❌ Wrong — AI directly queries the database
order = await db.execute("SELECT * FROM orders WHERE id = $1", [order_id])
```

### AI Actor Context

When the AI performs actions on behalf of a user session, it must carry a scoped `ActorContext` that represents the authenticated session — not a super-user identity. Pass this context on every Tool Gateway call.

### Adding a New AI Tool

1. Define the tool's input/output schema in `apps/ai/schemas/` (Pydantic models)
2. Define the contract in `@tavonza/contracts` so the API knows what to expose
3. Implement the tool handler in `apps/api/` under the relevant domain module
4. Register the tool in the Tool Gateway registry
5. Call it from your Python service via the Tool Gateway HTTP endpoint
6. Write `pytest` tests for your AI service logic
7. Write integration tests verifying authorization is enforced

### Python Code Rules

- Use **Python 3.11+**
- Use **Pydantic v2** for all request/response models — no raw dicts
- Use **async/await** throughout (FastAPI is async-first)
- Use **type hints** on every function — no untyped code
- Use **pytest** for tests, co-locate as `test_<module>.py`
- Pin all dependencies with exact versions in `requirements.txt`
- Use **python-dotenv** for env variables — never hardcode secrets

### AI-Specific Rules

- **No hallucinated data** — AI must only surface data retrieved via verified tool calls.
- **Audit everything** — Every tool invocation must be logged (structured JSON logs).
- **Fail closed** — If a tool call fails or authorization is denied, return a clear error. Never fabricate a fallback response.
- **No direct AWS SDK calls in AI business logic** — use the platform's storage/queue abstractions via the Tool Gateway.

---

## 12. Installing New Packages

### Adding a Dependency to a Specific App or Package

```bash
# Add to a specific workspace (e.g., the API)
pnpm --filter @tavonza/api add <package-name>

# Add a dev dependency
pnpm --filter @tavonza/api add -D <package-name>

# Add to a frontend app
pnpm --filter @frontend/admin add <package-name>
```

### Adding a Root Dev Dependency

For tooling that applies to the whole monorepo (e.g., prettier, eslint config):

```bash
pnpm add -D -w <package-name>
```

> **After every `pnpm add`** — the `pnpm-lock.yaml` will be updated. Commit it along with your `package.json` change.

---

## 13. Testing

### Running All Tests

```bash
pnpm test
```

### Running Tests for a Specific App

```bash
pnpm --filter @tavonza/api test
pnpm --filter @frontend/customer test
```

### Test Conventions

| Layer                    | Test Type             | Tool                     |
| ------------------------ | --------------------- | ------------------------ |
| Domain logic             | Unit tests            | Jest / Vitest            |
| Application services     | Unit tests with mocks | Jest / Vitest            |
| API endpoints            | Integration tests     | Jest + Supertest         |
| Frontend components      | Component tests       | Vitest + Testing Library |
| Authorization boundaries | Integration tests     | Jest + Supertest         |

### Writing Tests

- Test file location: co-locate with the source file as `<filename>.spec.ts` or `<filename>.test.ts`.
- Test description naming: use plain English — `it('should reject an order if the table is already closed', ...)`.
- **Never** test implementation details — test **behaviour**.
- Mock external dependencies (database, queue, AWS) at the infrastructure layer.

### Coverage

- Domain logic: aim for **> 80% coverage**.
- Authorization boundaries: **100% coverage** — every permission check must have a test that verifies a denied case.

---

## 14. Type Checking

Run typecheck before pushing to catch any type errors early:

```bash
# Typecheck all workspaces
pnpm typecheck
```

This is enforced automatically in CI on every push and PR. There is no separate lint step — TypeScript strict mode (`noImplicitAny`, `strictNullChecks`, etc.) in `tsconfig.base.json` acts as your code quality guard.

---

## 15. Pushing Your Changes

### Before Pushing — Checklist

```bash
# 1. Make sure your branch is up to date with dev
git fetch origin
git rebase origin/dev

# 2. Run typecheck
pnpm typecheck

# 3. Run tests
pnpm test

# 4. Stage your changes
git add .

# 5. Commit with a conventional commit message
git commit -m "feat(orders): add cancellation endpoint"

# 6. Push
git push origin feature/TAVN-123-add-order-cancellation
```

### Always Rebase, Never Merge

When syncing your branch with `dev`, **rebase** instead of merging to keep a clean linear history:

```bash
# ✅ Do this
git fetch origin
git rebase origin/dev

# ❌ Don't do this
git merge origin/dev
```

If you have conflicts during rebase:

```bash
# Fix the conflict in the file, then:
git add <conflicted-file>
git rebase --continue
```

---

## 16. Opening a Pull Request

### Steps

1. Push your branch to GitHub (see [Pushing Your Changes](#15-pushing-your-changes)).
2. Go to `https://github.com/tavonzaai/tavonzaai` — GitHub will prompt you to open a PR.
3. Fill in the **PR template** (`.github/pull_request_template.md`).
4. **Set the base branch to `dev`** — this is where all developer PRs land. Never target `prod` or `main` directly.
5. Assign yourself as the author.
6. Request review — the tech lead will be automatically notified via CODEOWNERS.

> **Hotfix exception:** If you need to fix a critical production bug urgently, open the PR targeting `prod`. After merging, immediately open a backport PR to `dev` so the fix isn't lost.

### PR Title

Follow the same Conventional Commit format:

```
feat(orders): add order cancellation endpoint
fix(auth): resolve refresh token expiry edge case
chore: update pnpm to 9.2.0
```

### PR Checklist (from the template)

- [ ] Base branch is `dev` (not `main` or `prod`)
- [ ] Does NOT bypass domain boundaries
- [ ] Does NOT import AWS SDKs into domain logic
- [ ] Preserves backend authorization authority
- [ ] Enforces tenant isolation
- [ ] Emits domain events for cross-domain workflows
- [ ] Includes an ADR under `.agent/ADR/` if changing architectural boundaries

### Review Process

- **Tech lead reviews all PRs to `dev`** — do not merge your own PR.
- CI (typecheck, tests, security audit) must be green before review.
- Resolve all review comments before the PR is merged.
- Use **"Squash and merge"** — keeps a clean linear history on `dev`.

### Draft PRs

If your work is not ready for review but you want early feedback or CI results, open a **Draft PR**. This prevents accidental merge while still triggering CI.

---

## 17. CI/CD Pipeline

### When CI Runs

CI runs automatically on every **PR and push** to `main`, `prod`, and `dev`.

### Smart Path-Based CI

CI only checks the parts of the repo that actually changed. If you only touched `frontend/admin/`, the API and staff app checks are **skipped** — no wasted time.

```
Every PR/push
      │
      ▼
 [detect-changes]           ← always runs (~5s)
  dorny/paths-filter
      │
      ├─ packages/**    ──► typecheck-packages (triggers everything)
      ├─ apps/api/**    ──► typecheck-api  +  test-api
      ├─ apps/ai/**     ──► typecheck-ai   +  test-ai
      ├─ apps/realtime/ ──► typecheck-realtime
      ├─ apps/worker/** ──► typecheck-worker
      ├─ frontend/admin ──► typecheck-frontend-admin
      ├─ frontend/cust. ──► typecheck-frontend-customer
      ├─ frontend/staff ──► typecheck-frontend-staff
      └─ .github/**     ──► ALL jobs run (CI config changed)

 [security-audit]           ← always runs on every push/PR
```

### CI Jobs

| Job              | Triggered by                                              |
| ---------------- | --------------------------------------------------------- |
| `typecheck-*`    | Path-filtered per workspace                               |
| `test-api`       | `apps/api/**` or `packages/**`                            |
| `test-ai`        | `apps/ai/**` or `packages/**`                             |
| `security-audit` | Always — reports HIGH/CRITICAL dependency vulnerabilities |

CI uses `pnpm --frozen-lockfile` — **do not edit `pnpm-lock.yaml` manually**.

### Deployment (auto-triggered on merge)

| Branch | Environment       | What happens                                     |
| ------ | ----------------- | ------------------------------------------------ |
| `dev`  | 🔵 Development    | Auto-deploys on push — team can test immediately |
| `prod` | 🟡 Pre-Production | Auto-deploys on push — QA and stress testing     |
| `main` | 🟢 Production     | Auto-deploys on push — live platform, real users |

---

## 18. Common Pitfalls & FAQ

### ❓ I ran `npm install` by mistake. What do I do?

Delete `package-lock.json` and `node_modules/`, then run `pnpm install`:

```bash
rm -rf node_modules package-lock.json
pnpm install
```

### ❓ CI fails with "Dependencies lock file is not found"

Your `pnpm-lock.yaml` was not committed. Fix it:

```bash
pnpm install   # regenerates pnpm-lock.yaml if missing
git add pnpm-lock.yaml
git commit -m "chore: track pnpm-lock.yaml for CI"
git push
```

### ❓ TypeScript shows "Module not found" for a workspace package

Make sure the package is built first. Workspace packages must be compiled before they can be consumed:

```bash
pnpm build
# or build just the specific package
pnpm --filter @tavonza/shared build
```

### ❓ My changes broke another workspace I didn't touch

You likely changed a shared package (`packages/*`). Run the full build and test suite:

```bash
pnpm build && pnpm test
```

### ❓ I accidentally committed to `main`, `prod`, or `dev` directly

```bash
# Undo the last commit (keeps your changes staged, does NOT lose your work)
git reset --soft HEAD~1

# Create a proper branch and push there instead
git checkout -b fix/TAVN-my-accidental-commit
git push origin fix/TAVN-my-accidental-commit

# Then open a PR targeting dev as normal
```

### ❓ How do I add an ADR (Architecture Decision Record)?

Create a file in `.agent/ADR/` following the existing format:

```
.agent/ADR/
└── ADR-001-use-postgresql-for-persistence.md
└── ADR-002-<your-decision>.md
```

ADRs are required for any change that alters architectural boundaries, adds new infrastructure, or changes the data model significantly.

---

## Getting Help

- **Architecture questions** — Read the `.agent/` docs first (especially `ARCHITECTURE.md`, `RULES.md`, `FLOWS.md`).
- **Blocked on a review** — Ping in the team channel with your PR link.
- **Security concerns** — Escalate directly to the tech lead; do not open a public issue.

---

_Last updated: September 2026 — Tavonza AI Platform Engineering Team_
