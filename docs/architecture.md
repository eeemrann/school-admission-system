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

The backend should be organized around responsibilities that can be tested independently:

- API/controllers: route binding, header extraction, HTTP status mapping, and Swagger metadata.
- Application services/use cases: create class, list class capacity, create hold, read hold, confirm hold, cancel hold, and list a student's applications.
- Domain model: class capacity invariants, application statuses, and legal state transitions.
- Persistence: EF Core DbContext, PostgreSQL mappings, migrations, constraints, and transaction helpers.
- Background processing: a hosted expiry worker with bounded batches and cancellation-aware polling.

The public routes and success field names are fixed in [api-contract.md](api-contract.md). Internal names and boundaries may evolve without changing that contract.

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

Seat-affecting operations will run in PostgreSQL transactions and lock the target class row (`SELECT ... FOR UPDATE` or the EF Core equivalent) before reading or changing counters. The same serialization point is used by:

1. hold creation, which expires due holds for the class, checks capacity, and increments `held_seats`;
2. confirmation, which expires/checks the target hold, moves one seat from held to confirmed, and changes status;
3. cancellation, which releases one held seat and changes status;
4. the expiry worker, which releases due held seats and marks them expired.

The transaction locks the class before dependent application state is changed. This prevents two concurrent requests from allocating the same final seat and makes the counter transition atomic. Database checks and unique indexes remain a second line of defense. Unique-violation or serialization failures must be translated into safe retry/conflict behavior rather than 500 responses.

Repeated confirmation is idempotent: an already confirmed application returns the confirmed result without incrementing counters. An expired application cannot be confirmed, even if the background worker has not yet run, because the confirmation transaction checks UTC time.

## Expiry processing

A hosted service will periodically claim/process due `HELD` applications in bounded batches. For each class represented in the batch it will acquire the class-row lock, re-check due status under the lock, decrement the held counter exactly once per transitioned application, and mark the applications `EXPIRED` in the same transaction. The worker will be cancellation-aware and will not prevent clean API shutdown.

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

## Docker deployment architecture

The final Compose stack will define:

- `db`: PostgreSQL 18 with a named volume and health check;
- `api`: the ASP.NET Core image, configured with the database connection and `HOLD_DURATION_SECONDS`, published on host port 8080;
- `frontend`: the React/Vite production-serving image, configured to call the API and published on the documented frontend port.

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
