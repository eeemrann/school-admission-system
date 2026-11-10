# School Admission System

Development is in progress. This repository currently contains the foundation documentation, an initial backend skeleton, the PostgreSQL persistence foundation, class-management endpoints, reservation endpoints, confirmation, cancellation, and student history. The background expiry worker, frontend, Docker images, full Compose application, and CI workflows have not yet been implemented.

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

The frontend will communicate only with the REST API. The API owns validation, application state transitions, expiry reconciliation, and seat allocation. The implemented reservation workflow reconciles due holds at request time; the background expiry worker is still planned. PostgreSQL enforces persistence and key invariants. See [docs/architecture.md](docs/architecture.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md).

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

The planned defaults are `HOLD_DURATION_SECONDS=600`, `HOLD_EXPIRY_POLL_INTERVAL_SECONDS=5`, and `HOLD_EXPIRY_BATCH_SIZE=100`.

The full command is not runnable yet because the API and frontend Dockerfiles, admission workflows, and frontend have intentionally not been created yet. The current Compose file contains the PostgreSQL 18 service only.

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

The frontend commands are planned for a later implementation stage. The current backend test project includes PostgreSQL-backed persistence tests and HTTP integration tests for class management, hold creation/read/reconciliation, confirmation, cancellation, student history, and concurrency behavior.

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
| Background expiry worker | Not started |
| Frontend UI | Not started |
| PostgreSQL persistence/schema/migration | Complete for the foundation milestone |
| Docker Compose database service | Complete; full application stack not started |
| Automated tests | 66 PostgreSQL-backed persistence and HTTP integration tests pass; frontend and worker coverage remains |
| CI/CD workflows | Not started |

Do not treat the current repository as a complete runnable application until the outstanding admission, frontend, Docker image, and CI work is complete and verified.
