# AGENTS.md

## Purpose

This repository contains a Dockerized school admission system for a private school. It is a recruitment take-home project, so correctness, clarity, reliability, automated tests, and maintainability take priority over unnecessary features.

These instructions apply to future Codex and developer sessions working in this repository.

## Before changing anything

- Review the relevant existing files before modifying them. Do not assume that a file is empty, generated, or safe to replace.
- Check the working-tree status before starting and preserve unrelated user changes.
- Read the applicable README, architecture notes, assumptions, and API contract before changing application behavior.
- Do not delete files, reset the worktree, change Git remotes, install dependencies, commit, or push unless the project owner explicitly requests it.
- Keep changes incremental and explain material architecture or business-rule decisions in the documentation and the final handoff.

## Technology and architecture standards

- Backend: C#, .NET 10 LTS, ASP.NET Core Web API, Entity Framework Core 10, PostgreSQL 18, and Swagger/OpenAPI.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Vitest, React Testing Library, and Playwright/Chromium for browser E2E coverage.
- Infrastructure: Docker, Docker Compose V2, GitHub Actions, and a future GitHub Container Registry publishing path.
- Keep backend, frontend, and database responsibilities separate. The frontend must use the REST API and must not access PostgreSQL directly.
- Keep the API contract in `docs/api-contract.md` authoritative. Do not rename paths, fields, statuses, or required headers without explicit project-owner approval and a documented contract revision.
- Use UTC timestamps at API, application, and database boundaries. Serialize timestamps in an unambiguous RFC 3339/ISO 8601 form.
- Use database transactions and PostgreSQL locking/constraints for admission invariants. Never rely on frontend validation for seat capacity or duplicate-application protection.
- Keep application and persistence logic testable. Avoid hidden global state and avoid coupling domain rules to HTTP or UI concerns.
- Use migrations for schema changes once the backend is implemented. Do not require manual database edits for normal startup or operation.

## Admission invariants

The implementation must preserve these invariants under concurrent requests:

- `heldSeats + confirmedSeats <= totalSeats` for every class at all times.
- A student cannot have multiple active applications for one class.
- A student cannot have multiple confirmed admissions for one class.
- Confirming an application repeatedly is idempotent and increments confirmed seats at most once.
- Expired holds cannot be confirmed and release their held seat exactly once.
- Application data survives container restarts through PostgreSQL persistence.

All state transitions that affect seat counters must use the agreed transactional class-row locking strategy and must be covered by PostgreSQL-backed integration/concurrency tests. Mutation paths must lock the class row before the application row. If a hold's class ID must first be discovered, perform a non-locking lookup, then lock the class and re-read/lock the hold. Expiry processing and normal API operations must use the same order.

## Validation and error handling

- Validate request bodies, required headers, identifiers, and numeric ranges at the API boundary.
- Return meaningful 4xx responses for expected validation, not-found, ownership, conflict, and business-rule failures. Do not turn expected failures into 500 responses.
- Use a consistent problem-details error shape and stable machine-readable error codes where useful; preserve the success response field names in the API contract.
- Treat `X-Student-Id` as untrusted input. The project intentionally has no authentication system, so it is an identity selector for this assignment, not proof of identity.

## Security rules

- Never commit passwords, tokens, private keys, connection strings containing secrets, or local `.env` files.
- Never add the confidential assignment PDF to Git.
- Use environment variables or local untracked configuration for secrets and document safe placeholders only.
- Do not log student identifiers, request headers, payment-like data, or database credentials unnecessarily. Avoid logging full personal data in normal application logs.
- Use parameterized queries/EF Core APIs, validate input lengths, and keep CORS and exposed ports narrowly configured for the local application.
- The simulated admission-fee confirmation must remain a local business transition; do not introduce a real payment integration without explicit approval.

## Testing requirements

- Backend unit tests must cover domain validation and state transitions.
- Integration tests must run against PostgreSQL, not an in-memory substitute, for persistence, constraints, expiry, and HTTP behavior.
- Concurrency tests must issue simultaneous PostgreSQL-backed hold and confirmation requests and prove that capacity and duplicate-application invariants hold.
- Frontend tests must use Vitest and React Testing Library and cover loading, successful flows, expiration/status refresh, cancellation, and understandable API errors.
- CI must cover backend build/tests, frontend build/tests, Docker image builds, and Docker Compose validation. GHCR publishing is reserved for approved releases.
- Do not weaken or remove a failing test merely to make CI green. Fix the behavior or document an explicitly approved contract change.

## Git discipline

- Do not commit or push automatically.
- Keep commits focused and reviewable, with imperative messages that explain the change.
- Before proposing a commit, inspect `git diff`, `git status`, and relevant test output.
- Do not mix formatting-only churn or generated artifacts with behavioral changes.

## API contract discipline

- The eight operations and field names in `docs/api-contract.md` are fixed for this assignment.
- New internal services, database tables, or frontend components may be introduced without changing the public contract.
- If an ambiguity requires a business decision, record it in `ASSUMPTIONS.md` and surface it to the project owner before implementing behavior that could affect clients.

## Current project phase

The repository has completed the .NET backend foundation, PostgreSQL persistence, Class Management API, transactional seat reservation, confirmation and cancellation workflows, student application history, the background expiry worker, the Phase 6A/6B/6C React frontend, the Phase 6D browser E2E harness, the Phase 7B backend API image, and the Phase 7C frontend image. The frontend includes routing, the shared UI system, student identity persistence/isolation, TanStack Query setup, typed API access, class browsing/application creation, server-authoritative countdowns, confirmation/cancellation dialogs with focus management, history actions, administrator metrics, class management, class creation, read-only class details, unit/component tests, and Playwright scenarios against a real API and disposable PostgreSQL database. The API image uses the pinned SDK `10.0.114` during its multi-stage build, publishes only the API output into an ASP.NET Core `10.0.14` runtime image, runs as the non-root `app` user, and does not apply migrations. The frontend image uses a Node.js 22 build stage and an unprivileged Nginx Alpine runtime on port `8080`; its default build-time API base is same-origin `/api`, which Nginx proxies to `api:8080`. Administrator routes remain intentionally unauthenticated because no administrator authentication contract exists. The migration service, full Docker application stack, CI/CD, and deployment remain pending. Do not claim that the complete application is runnable or implemented until those remaining components and their required automated tests have been verified.

For backend image work, build from the repository root with `docker build -f backend/Dockerfile -t school-admission-api:local .`. The image listens on container port `8080`; inject `ConnectionStrings__DefaultConnection`, `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`, and the hold/expiry configuration at runtime. `/health` is liveness and `/health/ready` checks PostgreSQL connectivity. Do not add credentials or `.env` files to the image, and do not use the development database volume for image verification.

For frontend work, use `npm install --prefix frontend`, `npm run lint --prefix frontend`, `npm run typecheck --prefix frontend`, `npm test --prefix frontend -- --run`, and `npm run build --prefix frontend`. Keep `frontend/.env.local` untracked and configure only the browser-facing `VITE_API_BASE_URL`; never place secrets in Vite variables.

For the production frontend image, build from the repository root with `docker build -f frontend/Dockerfile -t school-admission-frontend:local .`. The image serves only the Vite `dist/` output with unprivileged Nginx on port `8080`, uses `/api` as its safe build-time default, returns 404 for the exact `/api` path, proxies `/api/` descendants to the internal API after stripping the prefix, and must not contain local `.env` files or credentials.

For browser E2E work, use `npm run e2e --prefix frontend` after installing Chromium with `npx playwright install chromium`. The suite owns only its uniquely named, no-volume PostgreSQL container and its configured test ports. Never point it at the development database or remove existing containers/volumes.
