# School Admission System

Development is in progress. This repository contains the foundation documentation, a PostgreSQL-backed ASP.NET Core API with transactional admission workflows and background expiry processing, and the Phase 6A React frontend foundation. Docker images, the full Compose application, CI workflows, and the remaining frontend reservation interactions are still pending.

The planned system is a professional school admission workflow for administrators, students, and parents. Administrators will create classes and configure capacity. Students/parents will browse classes, temporarily hold a seat, simulate fee confirmation, track applications, and cancel an unconfirmed application. PostgreSQL transactions and constraints will protect capacity during concurrent admission requests.

## Planned technology stack

- Backend: C#, .NET 10 LTS, ASP.NET Core Web API, Entity Framework Core 10, PostgreSQL 18, and Swagger/OpenAPI.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router, Vitest, and React Testing Library.
- Infrastructure: Docker, Docker Compose V2, GitHub Actions, and a future GitHub Container Registry (GHCR) release path.

## Planned architecture

The repository will contain three runtime services:

1. PostgreSQL, with a named Docker volume for application data.
2. An ASP.NET Core API at `http://localhost:8080`.
3. A Vite-served React frontend at the documented local frontend URL, planned as `http://localhost:5173`.

The frontend will communicate only with the REST API. The API owns validation, application state transitions, expiry reconciliation, and seat allocation. Request-time reconciliation and the implemented hosted background expiry worker use the same class-first transaction strategy. PostgreSQL enforces persistence and key invariants. See [docs/architecture.md](docs/architecture.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md).

The public API is fixed and documented in [docs/api-contract.md](docs/api-contract.md). No authentication is required for this assignment; student identity is supplied by the `X-Student-Id` request header.

## Planned local URLs

| Service | Browser-facing URL | Purpose |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | React administrator and student/parent UI |
| Backend API | `http://localhost:8080` | REST API and Swagger/OpenAPI |

Docker-internal names such as `api` and `db` are used only for container-to-container communication. A browser uses the published `localhost` URLs above.

## Planned local startup

The current persistence milestone can be started and verified with:

```bash
docker compose up -d db
dotnet tool restore
dotnet ef database update \
  --project backend/src/SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj \
  --startup-project backend/src/SchoolAdmission.Api/SchoolAdmission.Api.csproj
```

After the remaining implementation is complete and reviewed, the intended single-command startup will be:

```bash
docker compose up --build
```

The API will be available at `http://localhost:8080`, with Swagger/OpenAPI exposed by the API service. The frontend will be available at `http://localhost:5173` unless the final Compose configuration documents a different port.

PostgreSQL will use a named volume mounted at `postgres_data:/var/lib/postgresql`, so application data and application history survive container restarts. The legacy PostgreSQL data mount `/var/lib/postgresql/data` is not used for the planned PostgreSQL 18 service.

The implemented defaults are `HOLD_DURATION_SECONDS=600`, `HOLD_EXPIRY_POLL_INTERVAL_SECONDS=5`, and `HOLD_EXPIRY_BATCH_SIZE=100`. The expiry interval and batch size must be positive integers; invalid values fail API startup.

The full command is not runnable yet because the API and frontend Dockerfiles and the final multi-service Compose wiring have not been created. The current Compose file contains the PostgreSQL 18 service only. The frontend can be run independently with the commands below.

## Frontend development

The Phase 6A frontend lives in `frontend/` and uses React 19, TypeScript strict mode, Vite, Tailwind CSS 4 through the official Vite plugin, React Router, TanStack Query, Lucide React, Vitest, and React Testing Library. Its feature-oriented structure separates application providers and routing, reusable layout/UI components, student/admin features, the typed REST client, configuration, identity context, hooks, and shared API types.

Create a local environment file from the safe placeholder and start the Vite development server:

```bash
cp frontend/.env.example frontend/.env.local
npm install --prefix frontend
npm run dev --prefix frontend
```

The browser talks to `VITE_API_BASE_URL` (default placeholder `http://localhost:8080`) and never connects to PostgreSQL. The selected `X-Student-Id` value is stored in browser local storage for convenience only; it is not authentication or proof of identity. The initial pages provide real class/history reads and administrator class creation through the existing contract, while hold/confirmation/cancellation interactions remain intentionally deferred.

## Planned verification

The intended checks after implementation are:

```bash
docker compose config
dotnet restore backend/SchoolAdmission.sln
dotnet build backend/SchoolAdmission.sln
dotnet test backend/SchoolAdmission.sln
npm ci --prefix frontend
npm run build --prefix frontend
npm run test --prefix frontend -- --run
```

The frontend commands are planned for a later implementation stage. The current backend test project includes 90 passing PostgreSQL-backed persistence, HTTP integration, expiry-worker, lifecycle, and concurrency tests. An opt-in stress test is documented below.

## Repository layout

Planned project structure:

```text
backend/                  ASP.NET Core API, domain, persistence, and tests
frontend/                 React/Vite/TypeScript application and tests
docs/                     Architecture and API documentation
.github/workflows/        CI and future release workflows
docker-compose.yml        Local multi-service development stack
AGENTS.md                 Permanent engineering instructions
ASSUMPTIONS.md            Explicit business-rule decisions and open questions
AI_USAGE.md               AI-assisted development record
```

## Development status

| Area | Status |
| --- | --- |
| Foundation documentation | Complete for the current phase |
| Backend solution/skeleton | Complete |
| Class management API | Complete for the current milestone |
| Hold creation/read API and request-time expiry reconciliation | Complete |
| Confirmation, cancellation, and student history | Complete for milestone 5B |
| Background expiry worker | Complete for the current backend milestone |
| Frontend foundation/UI | Phase 6A complete; reservation interactions remain |
| PostgreSQL persistence/schema/migration | Complete for the foundation milestone |
| Docker Compose database service | Complete; full application stack not started |
| Automated tests | 90 default PostgreSQL-backed tests pass; the opt-in 1,000-request stress test also passes; frontend has 7 Vitest/RTL tests |
| CI/CD workflows | Not started |

Do not treat the current repository as a complete runnable application until the outstanding frontend, Docker image, and CI work is complete and verified.

## Background expiry worker

The API hosts a `BackgroundService` that polls for overdue `HELD` applications even when no HTTP request is active. Each cycle discovers due class IDs without locking application rows, then processes each class in its own `ReadCommitted` PostgreSQL transaction: it locks the class row first, re-reads and locks due HELD applications, transitions only records still due, and decrements `heldSeats` once per successful transition. The configured batch limit bounds the number of applications transitioned per cycle, and a failure rolls back only the current class transaction while the worker retries on the next poll.

The worker uses `HOLD_EXPIRY_POLL_INTERVAL_SECONDS` and `HOLD_EXPIRY_BATCH_SIZE` from environment configuration. It creates a dependency-injection scope per cycle, uses the registered UTC `TimeProvider`, logs structured operational events without student IDs, observes shutdown cancellation, and continues after transient processing failures. Multiple API instances remain safe because the class row is the serialization point.

The opt-in PostgreSQL stress test is excluded from the default suite and can be run with:

```bash
dotnet test backend/SchoolAdmission.sln \
  -p:DefineConstants=STRESS_TESTS \
  --filter FullyQualifiedName~HoldStressTests
```

The verified run used one 120-seat class, 1,000 unique students, and 1,000 concurrent requests: 120 reservations succeeded, 880 returned `NO_SEATS_AVAILABLE`, and the final database state contained 120 HELD rows with `heldSeats=120` and `confirmedSeats=0`.
