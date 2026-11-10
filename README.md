# School Admission System

Development is in progress. This repository contains the foundation documentation, a PostgreSQL-backed ASP.NET Core API with transactional admission workflows and background expiry processing, the Phase 6A/6B/6C React student and administrator workflows, the Phase 6D real-browser E2E harness, the Phase 7B backend API image, and the Phase 7C frontend image. The migration service, full Compose application, CI workflows, and deployment are still pending.

The planned system is a professional school admission workflow for administrators, students, and parents. Administrators will create classes and configure capacity. Students/parents will browse classes, temporarily hold a seat, simulate fee confirmation, track applications, and cancel an unconfirmed application. PostgreSQL transactions and constraints will protect capacity during concurrent admission requests.

## Planned technology stack

- Backend: C#, .NET 10 LTS, ASP.NET Core Web API, Entity Framework Core 10, PostgreSQL 18, and Swagger/OpenAPI.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Vitest, React Testing Library, and Playwright/Chromium for browser E2E coverage.
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

## Backend API image

Phase 7B adds a multi-stage backend image. Build it from the repository root so the pinned SDK configuration and central package management remain available:

```bash
docker build -f backend/Dockerfile -t school-admission-api:local .
```

The build uses the official Microsoft .NET 10 SDK image as its base and installs the repository-pinned SDK `10.0.114` from Microsoft's published archive with SHA-512 verification. The final image uses the official ASP.NET Core `10.0.14` runtime, contains only published API output, runs as the unprivileged `app` user, and listens on container port `8080`.

The image does not apply EF Core migrations. Inject `ConnectionStrings__DefaultConnection`, `HOLD_DURATION_SECONDS`, `HOLD_EXPIRY_POLL_INTERVAL_SECONDS`, and `HOLD_EXPIRY_BATCH_SIZE` at runtime. The API's `/health` endpoint is process liveness; `/health/ready` verifies PostgreSQL connectivity. A reliable image-level HTTP health probe is deferred to the Compose integration phase because the minimal runtime image does not include `curl` or `wget`.

## Frontend image

Phase 7C adds a production frontend image. Build it from the repository root:

```bash
docker build -f frontend/Dockerfile -t school-admission-frontend:local .
```

The multi-stage build uses Node.js 22 and `npm ci` to produce the Vite `dist/` output, then serves only those static files with `nginxinc/nginx-unprivileged:stable-alpine` on container port `8080`. The image runs as the unprivileged `nginx` user, supports BrowserRouter refreshes through an `index.html` fallback, and sends same-origin `/api/*` requests through Nginx to the Docker-internal `api:8080` service after stripping the `/api` prefix. The exact `/api` path is intentionally a 404 rather than an SPA fallback; `/api/` and its descendants remain proxy paths. `VITE_API_BASE_URL` is a build-time Vite value; the image default is `/api`, while local development may continue using the documented host API URL or the Vite proxy.

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

The full command is not runnable yet because the frontend Dockerfile, migration service, and final multi-service Compose wiring have not been created. The current Compose file contains the PostgreSQL 18 service only. The backend image can be built independently with the command above, and the frontend can be run independently with the commands below.

## Frontend development

The Phase 6A/6B/6C frontend lives in `frontend/` and uses React 19, TypeScript strict mode, Vite, Tailwind CSS 4 through the official Vite plugin, React Router, TanStack Query, Lucide React, Vitest, and React Testing Library. Its feature-oriented structure separates application providers and routing, reusable layout/UI components, student/admin features, the typed REST client, configuration, identity context, hooks, and shared API types.

Create a local environment file from the safe placeholder and start the Vite development server:

```bash
cp frontend/.env.example frontend/.env.local
npm install --prefix frontend
npm run dev --prefix frontend
```

The browser talks to `VITE_API_BASE_URL` (default placeholder `http://localhost:8080`) and never connects to PostgreSQL. The selected `X-Student-Id` value is stored in browser local storage for convenience only; it is not authentication or proof of identity. The student portal supports the complete browse, hold, countdown, confirm, cancel, and history workflow through the existing contract. The administrator portal provides API-backed class metrics, searchable class management, class creation, and read-only class details. Administrator routes are intentionally unauthenticated because no administrator authentication contract exists. The backend remains authoritative for capacity, ownership, status, and expiry.

## Verification

The intended checks after implementation are:

```bash
docker compose config
dotnet restore backend/SchoolAdmission.sln
dotnet build backend/SchoolAdmission.sln
dotnet test backend/SchoolAdmission.sln
docker build -f backend/Dockerfile -t school-admission-api:local .
npm ci --prefix frontend
npm run build --prefix frontend
npm run test --prefix frontend -- --run
docker build -f frontend/Dockerfile -t school-admission-frontend:local .
```

The current backend test project includes 90 passing PostgreSQL-backed persistence, HTTP integration, expiry-worker, lifecycle, and concurrency tests. The frontend has 50 passing Vitest/React Testing Library tests, plus an opt-in Playwright suite that runs the browser against a disposable PostgreSQL 18 database and the real API. An opt-in stress test is documented below.

## End-to-end testing

The Phase 6D Playwright suite is deliberately separate from the development database. It starts a disposable PostgreSQL 18 container without a volume, assigns it a unique run ID and ownership label, records its actual container ID, applies the committed EF Core migrations, starts the API with a 15-second E2E hold duration and one-second expiry polling, and serves the Vite frontend through a local `/api` development proxy. Cleanup verifies both the recorded container ID and ownership label before stopping it, and uses bounded API process-group termination. Existing development containers and the `postgres_data` volume are not stopped, reset, or modified.

Prerequisites are Docker, Node/npm, a restored .NET SDK/toolchain, and Chromium installed for Playwright. From the repository root:

```bash
cd frontend
npm install
npx playwright install chromium
npm run e2e
```

`npm run e2e` is the single-command workflow. It produces `frontend/playwright-report/` and failure diagnostics under `frontend/test-results/`. The default disposable ports are PostgreSQL `55433`, API `5085`, and frontend `5175`; override them with `E2E_DB_PORT`, `E2E_API_PORT`, and `E2E_FRONTEND_PORT` if necessary. The setup fails rather than taking over an occupied port. Use `npm run e2e:report` to open the HTML report after a run.

The browser scenarios cover student browse/hold/confirm/cancel/history/refresh/identity isolation, worker-driven expiry and seat release observed through a non-reconciling class read, duplicate and browser-level no-seat conflicts, countdown-triggered authoritative hold refresh, repeated terminal mutations, administrator metrics/search/create/details, malformed and unknown IDs, and responsive navigation. Test data uses unique class names and student IDs within a fresh database, so tests do not depend on execution order. The E2E harness is ready to be called by a future CI workflow; CI orchestration itself remains outside Phase 6D.

If a default E2E port is occupied, set the corresponding `E2E_DB_PORT`, `E2E_API_PORT`, or `E2E_FRONTEND_PORT` variable for the command. If the Playwright browser cache is not writable, set `PLAYWRIGHT_BROWSERS_PATH` to a writable directory before installing Chromium. In disk-quota-limited environments, set `TMPDIR`, `TEMP`, and `TMP` to an ignored writable directory such as `.e2e-tmp` so .NET/MSBuild temporary files stay out of the system temp area. The local `postgres:18` tag currently resolves to a verified platform image digest during execution, but a multi-platform manifest digest has not been independently approved; digest pinning is deferred to CI hardening.

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
| Frontend student and administrator workflows | Phase 6A/6B/6C complete; Phase 6D E2E complete; frontend image complete; CI/deployment remain |
| PostgreSQL persistence/schema/migration | Complete for the foundation milestone |
| Backend API Docker image | Phase 7B complete; runtime smoke-verified; full Compose integration remains |
| Frontend Docker image | Phase 7C complete; runtime smoke verification performed; full Compose integration remains |
| Docker Compose database service | Complete; full application stack not started |
| Automated tests | 90 default PostgreSQL-backed tests pass; the opt-in 1,000-request stress test also passes; frontend has 50 Vitest/RTL tests plus Playwright E2E coverage |
| CI/CD workflows | Not started |

Do not treat the current repository as a complete runnable application until the outstanding migration service, full Compose, and CI work is complete and verified.

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
