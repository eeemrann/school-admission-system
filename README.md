# School Admission System

This repository contains a PostgreSQL-backed ASP.NET Core API with transactional admission workflows and background expiry processing, the React student and administrator workflows, the Playwright E2E harness, production Docker images, and a complete local Docker Compose deployment. CI workflows and public deployment remain future work.

The system is a professional school admission workflow for administrators, students, and parents. Administrators create classes and configure capacity. Students/parents browse classes, temporarily hold a seat, simulate fee confirmation, track applications, and cancel an unconfirmed application. PostgreSQL transactions and constraints protect capacity during concurrent admission requests.

## Technology stack

- Backend: C#, .NET 10 LTS, ASP.NET Core Web API, Entity Framework Core 10, PostgreSQL 18, and Swagger/OpenAPI.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Vitest, React Testing Library, and Playwright/Chromium for browser E2E coverage.
- Infrastructure: Docker, Docker Compose V2, GitHub Actions, and a future GitHub Container Registry (GHCR) release path.

## Architecture

The repository contains three application runtime services and one one-shot deployment service:

1. PostgreSQL, with a named Docker volume for application data.
2. An ASP.NET Core API at `http://localhost:8080`.
3. A Vite-built React frontend served at the documented local frontend URL, `http://localhost:5173`.
4. A migration service that applies existing EF Core migrations before the API starts.

The frontend will communicate only with the REST API. The API owns validation, application state transitions, expiry reconciliation, and seat allocation. Request-time reconciliation and the implemented hosted background expiry worker use the same class-first transaction strategy. PostgreSQL enforces persistence and key invariants. See [docs/architecture.md](docs/architecture.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md).

The public API is fixed and documented in [docs/api-contract.md](docs/api-contract.md). No authentication is required for this assignment; student identity is supplied by the `X-Student-Id` request header.

## Local URLs

| Service     | Browser-facing URL      | Purpose                                   |
| ----------- | ----------------------- | ----------------------------------------- |
| Frontend    | `http://localhost:5173` | React administrator and student/parent UI |
| Backend API | `http://localhost:8080` | REST API and Swagger/OpenAPI              |

Docker-internal names such as `api` and `db` are used only for container-to-container communication. A browser uses the published `localhost` URLs above.

## Backend API image

Phase 7B adds a multi-stage backend image. Build it from the repository root so the pinned SDK configuration and central package management remain available:

```bash
docker build -f backend/Dockerfile -t school-admission-api:local .
```

The build uses the official Microsoft .NET 10 SDK image as its base and installs the repository-pinned SDK `10.0.114` from Microsoft's published archive with SHA-512 verification. The final image uses the official ASP.NET Core `10.0.14` runtime, contains only published API output, runs as the unprivileged `app` user, and listens on container port `8080`.

The image does not apply EF Core migrations. Inject `ConnectionStrings__DefaultConnection`, `HOLD_DURATION_SECONDS`, `HOLD_EXPIRY_POLL_INTERVAL_SECONDS`, and `HOLD_EXPIRY_BATCH_SIZE` at runtime. The API's `/health` endpoint is process liveness; `/health/ready` verifies PostgreSQL connectivity. The API runtime includes `curl` solely for the Compose readiness probe and still runs the application as the non-root `app` user.

## EF Core migration image

Phase 7D adds a dedicated one-shot migrator target to the same multi-stage backend Dockerfile. The default target remains the API image:

```bash
docker build -f backend/Dockerfile -t school-admission-api:local .
docker build --target migrator -f backend/Dockerfile -t school-admission-migrator:local .
```

The migrator references the Infrastructure project and applies only committed EF Core migrations with `Database.MigrateAsync()`. It explicitly opens PostgreSQL before reading migration metadata, classifies structured PostgreSQL/Npgsql/socket failures, and retries only transient connectivity failures. Production defaults are 15 attempts with a two-second delay; bounded `MIGRATOR_MAX_ATTEMPTS` and `MIGRATOR_RETRY_DELAY_MILLISECONDS` overrides are available for disposable verification environments. Missing or permanent configuration failures exit with code `2`, exhausted transient database-unavailability exits with code `3`, migration failures exit with code `4`, and cancellation exits with code `130`. Connection strings are injected at runtime; they are never embedded in the image or written to logs. The image has no HTTP port, contains only the published migrator output, and runs as the non-root `app` user.

The API does not apply migrations at startup. The root Compose configuration starts the migrator after PostgreSQL becomes healthy and starts the API only after the migrator exits successfully.

## Frontend image

Phase 7C adds a production frontend image. Build it from the repository root:

```bash
docker build -f frontend/Dockerfile -t school-admission-frontend:local .
```

The multi-stage build uses Node.js 22 and `npm ci` to produce the Vite `dist/` output, then serves only those static files with `nginxinc/nginx-unprivileged:stable-alpine` on container port `8080`. The image runs as the unprivileged `nginx` user, supports BrowserRouter refreshes through an `index.html` fallback, and sends same-origin `/api/*` requests through Nginx to the Docker-internal `api:8080` service after stripping the `/api` prefix. The exact `/api` path is intentionally a 404 rather than an SPA fallback; `/api/` and its descendants remain proxy paths. `VITE_API_BASE_URL` is a build-time Vite value; the image default is `/api`, while local development may continue using the documented host API URL or the Vite proxy.

## Local Docker startup

Copy the safe environment template and replace the local password placeholder:

```bash
cp .env.example .env
```

Start the complete application from the repository root:

```bash
docker compose up
```

The API is available at `http://localhost:8080`, and the frontend is available at `http://localhost:5173`. Both ports can be changed with `API_HOST_PORT` and `FRONTEND_HOST_PORT` in `.env`.

PostgreSQL uses the new named volume `school-admission-assignment_postgres_data`, mounted at `postgres_data:/var/lib/postgresql`. It is separate from the protected `school-admission-system_postgres_data` volume. The legacy PostgreSQL data mount `/var/lib/postgresql/data` is not used.

The implemented defaults are `HOLD_DURATION_SECONDS=600`, `HOLD_EXPIRY_POLL_INTERVAL_SECONDS=5`, and `HOLD_EXPIRY_BATCH_SIZE=100`. The expiry interval and batch size must be positive integers; invalid values fail API startup.

Compose waits for PostgreSQL health, applies existing EF Core migrations in the one-shot migrator, waits for successful migration completion, and then starts the API and frontend. The API and frontend health checks use `curl` and Alpine BusyBox `wget`, respectively. Stop the application without deleting its persistent volume with `docker compose down` or `docker compose stop`; never use `docker compose down -v` for normal shutdown.

## Frontend development

The Phase 6A/6B/6C frontend lives in `frontend/` and uses React 19, TypeScript strict mode, Vite, Tailwind CSS 4 through the official Vite plugin, React Router, TanStack Query, Lucide React, Vitest, and React Testing Library. Its feature-oriented structure separates application providers and routing, reusable layout/UI components, student/admin features, the typed REST client, configuration, identity context, hooks, and shared API types.

Create a local environment file from the safe placeholder and start the Vite development server:

```bash
cp frontend/.env.example frontend/.env.local
npm install --prefix frontend
npm run dev --prefix frontend
```

The browser talks to `VITE_API_BASE_URL` (default placeholder `http://localhost:8080`) and never connects to PostgreSQL. The student portal requires exactly 17 numeric birth-registration digits and sends the trimmed value as `X-Student-Id`; the value is stored in browser local storage for convenience only and is not authentication or proof of identity. Class availability refreshes automatically every five seconds, while the backend remains authoritative for capacity, ownership, status, and expiry. The student portal supports the complete browse, hold, countdown, confirm, cancel, and history workflow through the existing contract. The administrator portal provides API-backed class metrics, searchable class management, class creation, and read-only class details. Administrator routes are intentionally unauthenticated because no administrator authentication contract exists.

## Verification

The intended checks after implementation are:

```bash
docker compose config
dotnet restore backend/SchoolAdmission.sln
dotnet build backend/SchoolAdmission.sln
dotnet test backend/SchoolAdmission.sln
docker build -f backend/Dockerfile -t school-admission-api:local .
docker build --target migrator -f backend/Dockerfile -t school-admission-migrator:local .
npm ci --prefix frontend
npm run build --prefix frontend
npm run test --prefix frontend -- --run
docker build -f frontend/Dockerfile -t school-admission-frontend:local .
```

The current backend test project includes 103 passing PostgreSQL-backed persistence, HTTP integration, expiry-worker, lifecycle, concurrency, direct migrator, and executable-process migration tests. The frontend has 54 passing Vitest/React Testing Library tests, plus an opt-in Playwright suite that runs the browser against a disposable PostgreSQL 18 database and the real API. An opt-in stress test is documented below.

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

Project structure:

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

| Area                                                          | Status                                                                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation documentation                                      | Complete for the current phase                                                                                                                                    |
| Backend solution/skeleton                                     | Complete                                                                                                                                                          |
| Class management API                                          | Complete for the current milestone                                                                                                                                |
| Hold creation/read API and request-time expiry reconciliation | Complete                                                                                                                                                          |
| Confirmation, cancellation, and student history               | Complete for milestone 5B                                                                                                                                         |
| Background expiry worker                                      | Complete for the current backend milestone                                                                                                                        |
| Frontend student and administrator workflows                  | Phase 6A/6B/6C complete; Phase 6D E2E complete; frontend image complete; CI/deployment remain                                                                     |
| PostgreSQL persistence/schema/migration                       | Complete for the foundation milestone                                                                                                                             |
| Backend API Docker image                                      | Complete; runtime readiness probe is available for Compose                                                                                                        |
| EF Core migration service/image                               | Complete; Compose runs it before the API                                                                                                                          |
| Frontend Docker image                                         | Complete; Compose serves it on the documented frontend port                                                                                                       |
| Docker Compose application                                    | Complete local stack with separate persistent volume; runtime verification reported below                                                                         |
| Automated tests                                               | 103 backend tests pass, including migrator tests; the opt-in 1,000-request stress test also passes; frontend has 54 Vitest/RTL tests plus Playwright E2E coverage |
| CI/CD workflows                                               | Not started                                                                                                                                                       |

The application is runnable through Docker Compose after the documented checks pass. CI/CD and public deployment remain outside this submission.

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
