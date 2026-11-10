# AI usage record

## Tools and responsibilities

### ChatGPT

ChatGPT is used by the project owner for:

- interpreting the assignment requirements;
- architecture planning;
- developing the engineering roadmap;
- preparing prompts and task instructions for Codex;
- technical review and engineering guidance.

### Codex

Codex is the local AI coding agent used under the project owner's direction for:

- local repository and development-environment inspection;
- foundation documentation generation and correction;
- backend persistence foundation, admission workflows, background expiry processing, and testing;
- frontend implementation and testing, plus Docker image and future CI implementation/testing.

The project owner directs the process and reviews all changes, decisions, test results, and final acceptance.

Neither tool may install tools without approval, add secrets, include the confidential assignment PDF, change Git remotes, commit or push automatically, claim unverified behavior, or silently resolve material business ambiguities.

## Completed work

Date: 2026-11-09

- ChatGPT interpreted the assignment, planned the initial architecture and engineering roadmap, prepared Codex task instructions, and provided technical review/guidance.
- Codex inspected the repository root, branch, remote, working-tree state, and available .NET, Node, npm, Docker, and Docker Compose tooling.
- Codex generated the foundation documentation and configuration files requested for the foundation phase.
- Codex reviewed and corrected the foundation documentation for expiry defaults, exact-once seat release, locking order, PostgreSQL 18 persistence, networking, error-code conventions, and AI disclosure.
- Codex implemented and verified the milestone 5B confirmation, cancellation, and student-history API workflows with PostgreSQL transactions, class-first locking, request-time expiry reconciliation, and HTTP concurrency tests.
- Codex implemented and verified milestone 5C: the hosted background expiry worker, validated poll/batch configuration, per-class PostgreSQL transactions with class-first locking, exact-once release, retry/shutdown handling, PostgreSQL-backed worker tests, and the opt-in 1,000-request stress test. The default backend suite passed 90 tests; the stress test passed with 120 successful reservations and 880 no-seat conflicts.
- Codex implemented and verified Phase 6A: the React/Vite/TypeScript frontend foundation, feature-based routing, accessible UI primitives, TanStack Query configuration, the typed REST client with Problem Details handling, browser-persisted assignment-level student identity, initial API-backed pages, and Vitest/React Testing Library tests.
- Codex implemented and verified Phase 6B: the complete student browse/hold/countdown/confirm/cancel/history workflow, server-authoritative expiry refresh, query invalidation, student cache isolation, accessible confirmation dialogs, and mocked HTTP/fake-timer workflow tests.
- Codex implemented Phase 6C: a responsive administrator shell, API-backed class capacity dashboard, searchable class management, contract-aligned class creation, and read-only class details with mocked frontend tests. Administrator authentication was intentionally not added because it is outside the current API contract.
- During the documented foundation phase, no backend application source code, Dockerfiles, CI workflows, commits, pushes, or remote changes were created. Phase 6A/6B frontend source and dependencies were added in the later frontend phases described below.

## Planned future work

Future work is planned, not completed. Codex is planned to implement and test full Docker Compose services and CI workflows after project-owner approval. ChatGPT is planned to continue providing interpretation, architecture review, technical guidance, and review of Codex's implementation.

## Ongoing change log

Future development sessions should append concise entries describing:

- the date and scope of AI-assisted work;
- files or behavior changed;
- tests and verification performed;
- owner corrections, rejected suggestions, or approved assumption changes;
- any known limitations left for follow-up.

| Date | Scope | Verification | Owner corrections/decisions |
| --- | --- | --- | --- |
| 2026-11-09 | Foundation inspection, documentation, and documentation corrections | Repository/toolchain inspection and documentation audit completed | Approved expiry defaults and locking/persistence clarifications recorded |
| 2026-11-10 | Backend solution and skeleton implementation | Restore, build, test, solution listing, package/reference inspection, and `/health`/Swagger smoke checks completed | Admission business logic and infrastructure intentionally deferred |
| 2026-11-10 | PostgreSQL and EF Core persistence foundation | Created domain persistence entities, EF Core mappings and migration, database Compose service, readiness health check, local EF tool manifest, and PostgreSQL-backed integration tests; restore, build, migration application, 12 tests, and health smoke checks passed | Host port 5432 was occupied, so local verification used an alternate host port; committed Compose defaults remain unchanged. Admission workflows, expiry worker, and API business endpoints remain deferred |
| 2026-11-10 | Class management API milestone | Implemented application DTOs/service validation, EF repository, controller endpoints, RFC 7807 error handling, TestServer PostgreSQL integration tests, and documentation updates; restore, build, 27 tests, health checks, and migration consistency verification passed | Hold operations, expiry worker, frontend, and CI remain intentionally deferred |
| 2026-11-10 | Reservation milestone 5A | Implemented `POST /classes/{classId}/holds` and `GET /holds/{holdId}`, PostgreSQL class-row locking, request-time expiry reconciliation, duplicate/no-seat conflict mapping, UTC hold duration configuration, and PostgreSQL-backed HTTP integration tests; the full suite passed with 46 tests after correcting reader disposal, expired-test fixture timestamps, and an xUnit collection assertion | Confirmation, cancellation, student history, background expiry worker, frontend, and CI remain intentionally deferred |
| 2026-11-10 | Admission milestone 5B | Implemented confirmation, cancellation, student history, ownership/state conflict handling, idempotent terminal operations, class-first transactional locking, request-time expiry reconciliation, and PostgreSQL-backed HTTP/concurrency tests; the full suite passed with 66 tests and no skipped tests | Background expiry worker, frontend, Docker images/full Compose application, and CI remain intentionally deferred |
| 2026-11-10 | Background expiry worker milestone 5C | Implemented hosted expiry processing, positive poll/batch configuration validation, per-class ReadCommitted transactions, class-first locking, exact-once release, failure recovery, graceful shutdown, PostgreSQL worker/race tests, and the opt-in 1,000-request stress test; 90 default tests and the stress test passed | Frontend, Docker images/full Compose application, CI/CD, and deployment remain intentionally deferred |
| 2026-11-10 | Frontend foundation Phase 6A | Added React 19/Vite/TypeScript frontend, Tailwind Vite integration, feature routes, accessible UI primitives, QueryClient defaults, typed API client, Problem Details parsing, student identity persistence, initial API-backed class/history/admin views, and 7 frontend tests; lint, typecheck, test, and build passed | Reservation/confirmation/cancellation UI, Docker images/full Compose application, CI/CD, and deployment remain intentionally deferred |
| 2026-11-10 | Complete student workflow Phase 6B | Added hold creation, live server-derived countdowns, authoritative expiry rechecks, confirmation/cancellation dialogs, history actions for all statuses, mutation invalidation, identity cache isolation, and mocked workflow tests; 24 frontend tests, lint, typecheck, formatting, and build passed; backend build and 90-test regression suite remained green | Docker images/full Compose application, CI/CD, and deployment remain intentionally deferred |
| 2026-11-10 | Administrator dashboard and class management Phase 6C | Added the responsive administrator shell, live aggregate capacity metrics, searchable class table, class creation dialog, read-only class details, shared class query cache, and frontend coverage for dashboard/list/create/detail/navigation states | Administrator authentication, application-wide admin reporting, Docker images/full Compose application, CI/CD, and deployment remain intentionally deferred |
| 2026-11-10 | Phase 6D E2E and QA foundation and hardening | Added Playwright/Chromium configuration, isolated no-volume PostgreSQL 18/API/frontend orchestration, real-browser student and administrator workflows, migration application in setup, metric edge-case tests, dialog focus trapping/restoration, run-owned container cleanup, atomic runtime state, bounded process teardown, worker-only expiry verification, browser no-seat/countdown/idempotency coverage, and stale frontend fixture stabilization; 47 frontend tests and 11 Playwright tests passed | E2E uses only disposable test infrastructure with unique data; PostgreSQL digest pinning awaits a verified multi-platform manifest; full Docker/CI integration remains intentionally deferred |
| 2026-11-10 | Phase 7B backend Docker image | Added `backend/Dockerfile` and the root `.dockerignore`; verified the Microsoft-published SDK `10.0.114` archive with SHA-512, published the API into the ASP.NET Core `10.0.14` runtime image, ran as the non-root `app` user, and verified `/health`, `/health/ready`, and graceful SIGTERM with a disposable no-volume container; the backend build passed and all 90 backend tests passed | The runtime image intentionally does not apply migrations and has no image-level HTTP healthcheck because it contains neither `curl` nor `wget`; the migration service, frontend image, and full Compose stack remain deferred |
| 2026-11-10 | Phase 7C frontend Docker image and final repair | Added `frontend/Dockerfile` and `frontend/nginx.conf`; used Node.js 22 with `npm ci`, built the Vite `dist/` output with same-origin `/api`, configured unprivileged Nginx on port 8080 with BrowserRouter fallback, exact `/api` 404 handling, API prefix stripping, asset caching, security headers, and writable temporary paths; repaired the process-group regression test by using unique workspace-backed markers after diagnosing `/tmp` `EDQUOT`, and added parent/child spawn and exit diagnostics; lint, typecheck, build, formatting, 14 frontend test files/50 tests, backend 90-test regression, and isolated image smoke checks passed in repeated runs | Full Compose wiring, migration service, CI/CD, and deployment remain deferred; npm audit findings remain dev-only follow-up work |
