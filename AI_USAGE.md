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
- backend persistence foundation implementation and testing;
- planned future application implementation and testing.

The project owner directs the process and reviews all changes, decisions, test results, and final acceptance.

Neither tool may install tools without approval, add secrets, include the confidential assignment PDF, change Git remotes, commit or push automatically, claim unverified behavior, or silently resolve material business ambiguities.

## Completed work

Date: 2026-11-09

- ChatGPT interpreted the assignment, planned the initial architecture and engineering roadmap, prepared Codex task instructions, and provided technical review/guidance.
- Codex inspected the repository root, branch, remote, working-tree state, and available .NET, Node, npm, Docker, and Docker Compose tooling.
- Codex generated the foundation documentation and configuration files requested for the foundation phase.
- Codex reviewed and corrected the foundation documentation for expiry defaults, exact-once seat release, locking order, PostgreSQL 18 persistence, networking, error-code conventions, and AI disclosure.
- At that foundation phase, no application source code, dependencies, Dockerfiles, CI workflows, commits, pushes, or remote changes were created.

## Planned future work

Future work is planned, not completed. Codex is planned to implement and test the admission backend, frontend, full Docker Compose services, concurrency controls, expiry worker, and CI workflows after project-owner approval. ChatGPT is planned to continue providing interpretation, architecture review, technical guidance, and review of Codex's implementation.

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
