# School Admission System

Development is in progress. This repository currently contains the project foundation and architecture documentation only; the backend, frontend, Docker images, database migrations, and automated tests have not yet been implemented.

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

The frontend will communicate only with the REST API. The API will own validation, application state transitions, expiry processing, and seat allocation. PostgreSQL will enforce persistence and key invariants. See [docs/architecture.md](docs/architecture.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md).

The public API is fixed and documented in [docs/api-contract.md](docs/api-contract.md). No authentication is required for this assignment; student identity is supplied by the `X-Student-Id` request header.

## Planned local URLs

| Service | Browser-facing URL | Purpose |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | React administrator and student/parent UI |
| Backend API | `http://localhost:8080` | REST API and Swagger/OpenAPI |

Docker-internal names such as `api` and `db` are used only for container-to-container communication. A browser uses the published `localhost` URLs above.

## Planned local startup

After implementation is complete and reviewed, the intended single-command startup will be:

```bash
docker compose up --build
```

The API will be available at `http://localhost:8080`, with Swagger/OpenAPI exposed by the API service. The frontend will be available at `http://localhost:5173` unless the final Compose configuration documents a different port.

PostgreSQL will use a named volume mounted at `postgres_data:/var/lib/postgresql`, so application data and application history survive container restarts. The legacy PostgreSQL data mount `/var/lib/postgresql/data` is not used for the planned PostgreSQL 18 service.

The planned defaults are `HOLD_DURATION_SECONDS=600`, `HOLD_EXPIRY_POLL_INTERVAL_SECONDS=5`, and `HOLD_EXPIRY_BATCH_SIZE=100`.

This command is not runnable yet because the application services and Dockerfiles have intentionally not been created in the foundation phase.

## Planned verification

The intended checks after implementation are:

```bash
docker compose config
dotnet build backend/SchoolAdmission.sln
dotnet test backend/SchoolAdmission.sln
npm ci --prefix frontend
npm run build --prefix frontend
npm run test --prefix frontend -- --run
```

The exact solution and package-script paths will be recorded when those projects are created. PostgreSQL-backed integration and concurrency tests must run in CI and in the documented local workflow.

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
| Backend API | Not started |
| Frontend UI | Not started |
| PostgreSQL schema/migrations | Not started |
| Docker Compose stack | Not started |
| Automated tests | Not started |
| CI/CD workflows | Not started |

Do not treat the current repository as a runnable application until the outstanding implementation work is complete and verified.
