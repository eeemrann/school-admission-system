# System architecture

## Status

This is the planned architecture for the school admission system. The implementation is intentionally not present yet; the foundation phase creates the design constraints that later code must satisfy.

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
- Infrastructure/persistence: EF Core DbContext, PostgreSQL mappings, migrations, constraints, transaction helpers, and repositories/adapters.
- Background processing: a hosted expiry worker with configured polling/batch limits and cancellation-aware execution.

The public routes and success field names are fixed in [api-contract.md](api-contract.md). Internal names and boundaries may evolve without changing that contract.

## Planned frontend structure

The React application will use a small feature-oriented structure:

- route-level views for the administrator experience and the student/parent experience;
- an API client layer that centralizes the browser-facing base URL, `X-Student-Id` handling, JSON parsing, and problem-details errors;
- feature components for class administration, class browsing, hold countdowns, application history, confirmation, and cancellation;
- local UI state for loading/errors and polling lifecycle, with the browser's local storage used only to restore the selected student ID;
- Tailwind CSS for presentation and React Router for navigation.

The browser calls the host API URL `http://localhost:8080`. It must never use Docker-internal service names such as `api` or `db`. The frontend does not connect directly to PostgreSQL.

## Planned data model

The likely relational model contains:

- `classes`: immutable public identity/name/capacity plus authoritative `held_seats` and `confirmed_seats` counters.
- `applications` or `holds`: public hold identity, class foreign key, student ID, status, UTC `expires_at`, and audit timestamps.

PostgreSQL defenses will include foreign keys, non-negative counter checks, and a check equivalent to:

```text
held_seats >= 0
confirmed_seats >= 0
held_seats + confirmed_seats <= total_seats
```

A partial unique index on `(student_id, class_id)` for `HELD` and `CONFIRMED` rows will backstop duplicate active/confirmed applications. Historical `EXPIRED` and `CANCELLED` rows remain queryable. The exact schema and migration names will be finalized during implementation.

## Concurrency strategy

Seat-affecting operations will run in PostgreSQL transactions and lock the target class row (`SELECT ... FOR UPDATE` or the EF Core equivalent) before reading or changing counters. All mutation paths use the same lock order: class row first, application/hold row second. The same serialization point is used by:

1. hold creation, which expires due holds for the class, checks capacity, and increments `held_seats`;
2. confirmation, which expires/checks the target hold, moves one seat from held to confirmed, and changes status;
3. cancellation, which releases one held seat and changes status;
4. the expiry worker, which releases due held seats and marks them expired.

If a hold's class ID must first be discovered, the operation performs an initial non-locking lookup, then locks the class row, re-reads the hold, and locks the hold row. Expiry processing and normal API operations follow this same locking order; no path may acquire the application row before the class row. This prevents deadlocks, prevents two concurrent requests from allocating the same final seat, and makes each counter transition atomic. Database checks and unique indexes remain a second line of defense. Unique-violation or serialization failures must be translated into safe retry/conflict behavior rather than 500 responses.

Repeated confirmation is idempotent: an already confirmed application returns the confirmed result without incrementing counters. An expired application cannot be confirmed, even if the background worker has not yet run, because the confirmation transaction rejects `expiresAt <= currentUtcTime`. Expiration is reconciled exactly once, each hold releases its seat at most once, and database checks ensure that counters never become negative.

## Expiry processing

A hosted service will periodically claim/process due `HELD` applications in bounded batches. The planned defaults are a `HOLD_EXPIRY_POLL_INTERVAL_SECONDS` of `5` and a `HOLD_EXPIRY_BATCH_SIZE` of `100`. For each class represented in the batch it will acquire the class-row lock, re-check due status under the lock, lock each application row after its class row, decrement the held counter exactly once per transitioned application, and mark the applications `EXPIRED` in the same transaction. The worker will be cancellation-aware and will not prevent clean API shutdown.

User-facing API operations also reconcile due holds in their relevant transaction. This provides prompt correctness for a hold being confirmed or a class being read, while the worker ensures release still happens when no browser is active.

## Data flow

### Student flow

1. The student enters a registration ID in the frontend.
2. The frontend sends `X-Student-Id` with the hold, confirm, cancel, and list requests.
3. The API validates the request and applies a transaction under the class lock.
4. PostgreSQL commits the hold/status/counter change or rolls it back as one unit.
5. The frontend displays the returned status and expiration time, then polls the relevant application list/hold state while a hold is active so expiration appears without a manual refresh.
6. The browser persists the student ID locally for convenience only; the API/database remains the source of truth and the UI can restore applications after reopening.

### Administrator flow

1. The admin UI submits a class name and positive capacity.
2. The API validates and persists the class.
3. The class list reads authoritative counters and derives `availableSeats` as `totalSeats - heldSeats - confirmedSeats`.

## Browser and Docker networking

The final Compose project will place `api` and `db` on a private Docker network. The API connects to PostgreSQL using the Docker-internal hostname `db` and PostgreSQL's container port. The browser is outside that network and connects through published host ports:

| Caller | Destination | URL/hostname |
| --- | --- | --- |
| Browser | Frontend | `http://localhost:5173` |
| Browser | API | `http://localhost:8080` |
| API container | PostgreSQL container | `db` plus the PostgreSQL container port |

The `api` and `db` service names are not browser-facing URLs. CORS will allow the documented frontend origin to call the documented API origin. The API must bind to its container interface so the host-published port is reachable.

## Docker deployment architecture

The final Compose stack will define:

- `db`: PostgreSQL 18 with the named volume mount `postgres_data:/var/lib/postgresql` and a health check. The legacy `/var/lib/postgresql/data` mount is not used with PostgreSQL 18;
- `api`: the ASP.NET Core image, configured with the database connection and `HOLD_DURATION_SECONDS`, published on host port 8080;
- `frontend`: the React/Vite production-serving image, configured with the browser-facing API URL `http://localhost:8080` and published on host port 5173.

The API should wait for database readiness and apply reviewed migrations through the normal startup workflow. Secrets must be supplied through environment configuration and must not be committed. Dockerfiles, Compose, and service health checks are implementation work deferred from this foundation phase.

## Testing strategy

- Domain/unit tests: validation, legal status transitions, duration handling, and idempotent confirmation.
- API integration tests: all eight operations, headers, response shapes, problem details, not-found cases, and persistence.
- PostgreSQL-backed concurrency tests: simultaneous holds at capacity, simultaneous duplicate applications, competing confirmation/expiry, repeated confirmation, and cancellation races. These must use real PostgreSQL behavior rather than an in-memory provider.
- Restart/persistence test: create application data, restart the database/API containers, and verify the data remains available through the API.
- Frontend component/integration tests: class creation/listing, student identifier persistence, hold countdown, automatic status updates, confirmation, cancellation, history, loading, and API errors using Vitest and React Testing Library.
- Container smoke checks: Compose configuration, health/readiness, API reachability on port 8080, and frontend reachability.

## CI/CD strategy

GitHub Actions will be added after the implementation exists. Planned checks include:

- backend restore/build;
- backend unit and PostgreSQL-backed integration/concurrency tests;
- frontend dependency installation, build, and Vitest tests;
- Docker image builds for API and frontend;
- `docker compose config` validation and a Compose smoke test where CI resources permit;
- a separate, approval-controlled release workflow that publishes versioned images to GHCR only on releases.

CI must not publish or deploy from ordinary pull requests. Image tags, credentials, and release permissions will be documented when the workflows are implemented.
