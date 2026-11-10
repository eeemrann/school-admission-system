# System architecture

## Status

This is the architecture for the school admission system. The initial backend solution, health/Swagger skeleton, PostgreSQL persistence foundation, initial migration, database readiness endpoint, database-only Compose service, class-management API, reservation endpoints, confirmation, cancellation, student history, background expiry worker, and their PostgreSQL-backed integration/concurrency tests now exist. The Phase 6A/6B/6C frontend now includes routing, shared UI primitives, typed REST access, student identity persistence/isolation, QueryClient configuration, class browsing, hold creation, server-authoritative countdowns, confirmation/cancellation actions, history recovery, administrator dashboard metrics, class management/creation, read-only class details, and workflow tests. Phase 6D adds real-browser Playwright coverage against disposable PostgreSQL infrastructure and dialog accessibility regression coverage. Phase 7B adds the multi-stage backend API image and Phase 7C adds the multi-stage React/Nginx frontend image. The migration service, full Compose deployment, and CI remain future implementation stages.

## Runtime boundaries

```text
Browser
  |
  | HTTP/JSON, X-Student-Id for student operations
  v
React 19 + TypeScript + Vite frontend
  |
  | REST API calls
  v
ASP.NET Core Web API (.NET 10)
  |
  | EF Core 10 / Npgsql, migrations, transactions
  v
PostgreSQL 18
  |
  `-- named Docker volume for durable application data
```

The frontend owns presentation, navigation, polling/countdown display, and user-friendly error presentation. The API owns authorization-by-supplied-student-id, validation, state transitions, expiry processing, and all seat decisions. PostgreSQL owns durable state, relational integrity, and database-level defenses for admission invariants.

The API is the only component allowed to access PostgreSQL. The browser must never receive database credentials or connect directly to the database.

## Planned backend structure

The backend should be organized as cleanly separated layers with dependencies pointing inward and each layer testable independently:

- API/presentation: route binding, header extraction, HTTP status mapping, problem details, and Swagger metadata.
- Application: use cases for class creation/listing, hold creation/reading, confirmation, cancellation, and student application history.
- Domain: class capacity invariants, application statuses, legal state transitions, and UTC time rules without HTTP or database concerns.
- Infrastructure/persistence: EF Core DbContext, PostgreSQL mappings, migrations, constraints, transaction helpers, and repositories/adapters. The current persistence foundation uses `SchoolAdmissionDbContext` and migrations in the Infrastructure project.
- Background processing: an implemented hosted expiry worker with configured polling/batch limits, scoped services, structured logging, transient-failure recovery, and cancellation-aware execution.

The public routes and success field names are fixed in [api-contract.md](api-contract.md). Internal names and boundaries may evolve without changing that contract.

## Frontend structure

The React application uses a small feature-oriented structure:

- route-level views for the administrator experience and the student/parent experience;
- an API client layer that centralizes the browser-facing base URL, `X-Student-Id` handling, JSON parsing, and problem-details errors;
- feature components for class administration/dashboard, class browsing, hold creation/countdowns, application history, confirmation, and cancellation;
- local UI state for loading/errors and future polling lifecycle, with the browser's local storage used only to restore the selected student ID;
- Tailwind CSS for presentation and React Router for navigation.

The current implementation lives under `frontend/src/`:

- `app/` owns `App`, routing, and application-level providers;
- `components/layout/` and `components/ui/` provide the shared shell and accessible design-system primitives;
- `features/classes/`, `features/student/`, `features/admin/`, `features/landing/`, and `features/not-found/` own route-level behavior;
- `lib/api/` owns the centralized typed fetch client and RFC 7807 Problem Details errors;
- `lib/config/`, `contexts/`, `hooks/`, `types/`, and `styles/` hold configuration, browser identity state, shared API models, and Tailwind styles.

The administrator portal has its own responsive sidebar layout under `components/layout/AdminLayout.tsx`. Its dashboard and class-management views use the existing `GET /classes`, `GET /classes/{classId}`, and `POST /classes` contract. Aggregate counts and utilization percentages are pure frontend derivations of returned `ClassSummary` values; the UI does not fabricate application, student, revenue, or payment reporting. Administrator class creation invalidates the shared `classes` cache used by the student catalogue and administrator views. The portal is intentionally unauthenticated because the assignment provides no administrator authentication API.

The frontend uses the official Tailwind CSS Vite plugin and requires `VITE_API_BASE_URL`. Missing or invalid API configuration is surfaced as an understandable UI error rather than silently targeting an unknown service. TanStack Query uses a 30-second default stale time, a five-minute cache lifetime, no focus refetch, and no repeated retries for business 4xx responses. Student mutations invalidate class availability, student history, and individual hold queries as appropriate.

In development, the browser may call the host API URL `http://localhost:8080` or use the Vite `/api` proxy. In the production frontend image, the browser always calls same-origin `/api`; unprivileged Nginx strips that prefix and proxies `/api/` descendants to the Docker-internal `api:8080` service. The exact `/api` path returns 404 so it cannot fall through to the SPA, while `/api/` remains an API proxy path. The browser must never resolve Docker-internal service names such as `api` or `db`, and the frontend does not connect directly to PostgreSQL.

## Planned data model

The current relational model contains:

- `admission_classes`: immutable public identity/name/capacity plus authoritative `held_seats` and `confirmed_seats` counters.
- `admission_holds`: public hold identity, class foreign key, student ID, uppercase status, UTC `expires_at`, and audit timestamps.

PostgreSQL defenses will include foreign keys, non-negative counter checks, and a check equivalent to:

```text
held_seats >= 0
confirmed_seats >= 0
held_seats + confirmed_seats <= total_seats
```

A partial unique index on `(class_id, student_id)` for `HELD` and `CONFIRMED` rows backstops duplicate active/confirmed applications. Historical `EXPIRED` and `CANCELLED` rows remain queryable. The initial migration is `InitialCreate` in the Infrastructure project.

## Concurrency strategy

Seat-affecting operations will run in PostgreSQL transactions and lock the target class row (`SELECT ... FOR UPDATE` or the EF Core equivalent) before reading or changing counters. All mutation paths use the same lock order: class row first, application/hold row second. The same serialization point is used by:

1. hold creation, which expires due holds for the class, checks duplicate active applications and capacity, and increments `held_seats`;
2. confirmation, which expires/checks the target hold, moves one seat from held to confirmed, and changes status;
3. cancellation, which releases one held seat and changes status;
4. the hosted expiry worker, which releases due held seats and marks them expired without requiring an HTTP request.

If a hold's class ID must first be discovered, the operation performs an initial non-locking lookup, then locks the class row, re-reads the hold, and locks the hold row. Expiry processing and normal API operations follow this same locking order; no path may acquire the application row before the class row. This prevents deadlocks, prevents two concurrent requests from allocating the same final seat, and makes each counter transition atomic. Database checks and unique indexes remain a second line of defense. Unique-violation or serialization failures must be translated into safe retry/conflict behavior rather than 500 responses.

Repeated confirmation is idempotent: an already confirmed application returns the confirmed result without incrementing counters. An expired application cannot be confirmed, even if the background worker has not yet run, because the confirmation transaction rejects `expiresAt <= currentUtcTime`. Expiration is reconciled exactly once, each hold releases its seat at most once, and database checks ensure that counters never become negative.

## Expiry processing

A hosted `BackgroundService` periodically processes due `HELD` applications in bounded batches. The defaults are `HOLD_EXPIRY_POLL_INTERVAL_SECONDS=5` and `HOLD_EXPIRY_BATCH_SIZE=100`; both must be positive integers and invalid values fail startup. Each cycle performs a non-locking candidate lookup, then processes each selected class in its own `ReadCommitted` transaction. The transaction locks the class row first, re-reads due HELD applications, locks those application rows second, rechecks status and expiry, transitions only eligible records to `EXPIRED`, decrements `held_seats` by the actual transition count, and commits atomically. A class transaction therefore never decrements for a row that another worker already expired, and a failure rolls back that class while previously committed classes remain valid.

The worker creates a dependency-injection scope for each cycle, uses the registered UTC `TimeProvider`, logs counts and failures without student identifiers, observes shutdown cancellation, and retries on the next poll after an unexpected exception. Multiple API instances are safe because all expiry and seat-mutating operations serialize through the class-row lock. Request-time reconciliation remains in place as a correctness safety net between worker cycles.

The implemented hold creation, hold-read, confirmation, cancellation, and student-history API operations reconcile due holds in their relevant transaction. This provides prompt correctness for capacity decisions, state transitions, hold reads, and history reads. The future worker will use the same reconciliation mechanism so release still happens when no browser is active.

## Data flow

### Student flow

1. The student enters a registration ID in the frontend.
2. The frontend sends `X-Student-Id` with the hold, confirm, cancel, and list requests.
3. The API validates the request and applies a transaction under the class lock.
4. PostgreSQL commits the hold/status/counter change or rolls it back as one unit. Hold creation locks the class row first, reconciles due holds, checks active duplicates and capacity, then persists the new hold and counter increment in the same transaction.
5. The frontend displays returned class/history state and derives a once-per-second countdown from the server-provided `expiresAt`. When the countdown reaches zero, it refetches the individual hold; it never changes authoritative status locally or confirms based only on the timer.
6. The browser persists the student ID locally for convenience only; the API/database remains the source of truth and the UI can restore applications after reopening.

### Administrator flow

1. The admin UI submits a class name and positive capacity.
2. The API validates and persists the class.
3. TanStack Query invalidates the shared class list and detail caches after a successful creation.
4. The dashboard and class list read authoritative counters and derive utilization for presentation; `availableSeats` remains the API-provided value.

## Browser and Docker networking

The final Compose project will place `api` and `db` on a private Docker network. The API connects to PostgreSQL using the Docker-internal hostname `db` and PostgreSQL's container port. The browser is outside that network and connects through published host ports:

| Caller | Destination | URL/hostname |
| --- | --- | --- |
| Browser | Frontend | `http://localhost:5173` |
| Browser | API | `http://localhost:8080` |
| API container | PostgreSQL container | `db` plus the PostgreSQL container port |

The `api` and `db` service names are not browser-facing URLs. CORS will allow the documented frontend origin to call the documented API origin. The API must bind to its container interface so the host-published port is reachable.

## Backend container image

The backend image is built from the repository root with:

```bash
docker build -f backend/Dockerfile -t school-admission-api:local .
```

The root context is required because `global.json`, `Directory.Build.props`, and `Directory.Packages.props` are repository-level restore inputs. The multi-stage build copies project files before source files to preserve the NuGet restore cache. It uses the official Microsoft .NET 10 SDK image as the build base, installs the exact SDK `10.0.114` published by Microsoft because that SDK is not available as an MCR image tag, verifies the archive with SHA-512, and publishes the API with apphost generation disabled.

The final stage uses `mcr.microsoft.com/dotnet/aspnet:10.0.14`, copies only `/app/publish`, runs as the built-in unprivileged `app` user, and listens on container port `8080` through `ASPNETCORE_URLS=http://+:8080`. No connection string, secret, or `.env` file is embedded. Runtime configuration is injected through environment variables.

The image does not apply EF Core migrations. The API exposes `/health` as a process-liveness endpoint and `/health/ready` as a PostgreSQL connectivity/readiness endpoint. The selected minimal runtime image does not contain `curl` or `wget`, so an image-level HTTP `HEALTHCHECK` is deferred until the Compose phase selects and verifies a probe strategy.

## Docker deployment architecture

The final Compose stack will define:

- `db`: PostgreSQL 18 with the named volume mount `postgres_data:/var/lib/postgresql` and a health check. The legacy `/var/lib/postgresql/data` mount is not used with PostgreSQL 18;
- `migrate`: a future one-shot migration service that runs reviewed EF Core migrations before the API starts;
- `api`: the ASP.NET Core image, configured with the database connection and `HOLD_DURATION_SECONDS`, published on host port 8080;
- `frontend`: the React/Vite production-serving image, configured with the browser-facing API URL `http://localhost:8080` and published on host port 5173.

The future Compose stack should wait for database readiness, run the one-shot `migrate` service, and start the API only after migration succeeds. The API image itself must not apply migrations during startup. Secrets must be supplied through environment configuration and must not be committed. The Phase 7C frontend image serves the Vite output with unprivileged Nginx on port `8080`, provides BrowserRouter fallback handling, and proxies same-origin `/api/` requests to `api:8080`; only its full multi-service Compose integration remains future work.

The current Compose file contains only the `db` service for this persistence milestone. It uses PostgreSQL 18, a named `postgres_data` volume mounted at `/var/lib/postgresql`, and the standard host port 5432. If that host port is occupied locally, an untracked Compose override or an alternate local verification port may be used without changing the documented container port or committed defaults.

## Database migration workflow

The repository pins the local `dotnet-ef` tool to EF Core 10.0.14 in `.config/dotnet-tools.json`. Restore it before using migration commands:

```bash
dotnet tool restore
```

With PostgreSQL running and `ConnectionStrings__DefaultConnection` set to a safe local connection string, list or apply migrations:

```bash
dotnet ef migrations list \
  --project backend/src/SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj \
  --startup-project backend/src/SchoolAdmission.Api/SchoolAdmission.Api.csproj \
  --context SchoolAdmission.Infrastructure.Persistence.SchoolAdmissionDbContext

dotnet ef database update \
  --project backend/src/SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj \
  --startup-project backend/src/SchoolAdmission.Api/SchoolAdmission.Api.csproj \
  --context SchoolAdmission.Infrastructure.Persistence.SchoolAdmissionDbContext
```

To add a future migration, use an intentional name and the same project/context boundaries:

```bash
dotnet ef migrations add <MigrationName> \
  --project backend/src/SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj \
  --startup-project backend/src/SchoolAdmission.Api/SchoolAdmission.Api.csproj \
  --context SchoolAdmission.Infrastructure.Persistence.SchoolAdmissionDbContext \
  --output-dir Persistence/Migrations
```

Migrations are applied incrementally. Do not delete or recreate the database as part of normal development, and inspect generated migration SQL/operations before applying schema changes.

## Testing strategy

- Domain/unit tests: validation, legal status transitions, duration handling, and idempotent confirmation.
- API integration tests: implemented class operations, hold creation/read, request-time expiry reconciliation, confirmation, cancellation, student history, response shapes, problem details, malformed/not-found cases, duplicate/no-seat behavior, and persistence.
- PostgreSQL-backed concurrency tests: simultaneous holds at capacity, simultaneous duplicate applications, confirmation idempotency, cancellation idempotency, and confirmation-versus-cancellation races. These use real PostgreSQL behavior rather than an in-memory provider.
- Expiry-worker tests: due/future/terminal status handling, exact-once release, bounded batches, multiple classes, concurrent processors, expiry races with reservation/confirmation/cancellation, rollback, hosted lifecycle, configuration validation, and recovery after a transient failure. These use real PostgreSQL for persistence and a direct worker test for retry/lifecycle behavior.
- Opt-in stress test: a repeatable PostgreSQL-backed 1,000-request scenario against one 120-seat class. It is excluded from the default suite and is run with `-p:DefineConstants=STRESS_TESTS --filter FullyQualifiedName~HoldStressTests`; the verified run accepted 120 reservations and rejected 880 with no capacity violation.
- Restart/persistence test: create application data, restart the database/API containers, and verify the data remains available through the API.
- Frontend component/integration tests: administrator dashboard aggregation, class listing/search, class creation validation/invalidation, class details/navigation, student identifier persistence, hold countdown, automatic status updates, confirmation, cancellation, history, loading, and API errors using Vitest and React Testing Library.
- Browser E2E tests: Playwright/Chromium runs the Vite frontend against the actual ASP.NET Core API and a fresh PostgreSQL 18 container. The setup applies the existing EF Core migrations, configures a short E2E-only hold duration and worker interval, and never uses the development database or its named volume. Student workflows cover identity selection/isolation, class browsing, reservation, server-derived countdowns, confirmation, cancellation, refresh recovery, duplicate/no-seat conflicts, worker expiry, and seat release. Administrator workflows cover live metrics, case-insensitive trimmed search, class creation/validation, details/not-found handling, and responsive navigation.
- Dialog accessibility tests: shared dialogs trap Tab focus, close on Escape, restore the invoking element's focus, expose semantic dialog names, and retain visible keyboard focus styles.
- Container smoke checks: Compose configuration, health/readiness, API reachability on port 8080, and frontend reachability.

The Playwright command is documented in the repository README and is run from `frontend/` with `npm run e2e`. It creates an isolated, no-volume database on host port 55433 by default, gives the disposable container a unique run ID and ownership label, records its actual container ID, runs `dotnet tool restore` and `dotnet ef database update` against that database, starts the API on port 5085 with a 15-second E2E hold duration and one-second expiry polling, and lets Playwright manage the Vite server on port 5175. `E2E_DB_PORT`, `E2E_API_PORT`, and `E2E_FRONTEND_PORT` may override those ports. The setup checks that ports are free and fails safely instead of taking over an existing service. Runtime state is written atomically and validated during teardown; Docker and API cleanup use bounded commands and only current-run ownership metadata. HTML reports, screenshots, videos, and traces are written to ignored Playwright output directories. The `postgres:18` tag remains unpinned until a verified multi-platform manifest digest is approved for CI.

## CI/CD strategy

GitHub Actions will be added after the implementation exists. Planned checks include:

- backend restore/build;
- backend unit and PostgreSQL-backed integration/concurrency tests;
- frontend dependency installation, build, and Vitest tests;
- Docker image builds for API and frontend;
- `docker compose config` validation and a Compose smoke test where CI resources permit;
- a separate, approval-controlled release workflow that publishes versioned images to GHCR only on releases.

CI must not publish or deploy from ordinary pull requests. Image tags, credentials, and release permissions will be documented when the workflows are implemented.
