# Assumptions and open business decisions

This document makes decisions explicit where the supplied requirements do not fully define behavior. These are recommended defaults for implementation and should be approved by the project owner before the corresponding behavior is built.

## Identity and authorization

- No login or authentication system is required.
- `X-Student-Id` is required for hold creation, confirmation, cancellation, and the student's application list. It is treated as a trimmed, exactly 17-digit numeric birth registration number.
- The student portal may collect an optional human-facing student name and stores it in browser local storage for the profile display; the name is not part of the API identity contract or an authentication credential. The 17-digit number alone is sufficient to select the assignment identity.
- The header is an assignment-level identity selector, not a security proof. The API must still enforce that a student can mutate only their own hold.
- Class creation is available to the administrator UI without a separate admin login because no admin authentication contract was supplied.

## Class data

- `totalSeats` must be a positive integer.
- A class name must be non-empty after trimming.
- A class name may be updated by an administrator after creation through `PATCH /classes/{classId}`. The update preserves the opaque class ID, seat counters, and application history.
- Class deletion is not part of the public API. Class capacity may be increased through the public API, but never decreased because doing so could invalidate existing reservations.
- Class IDs and hold IDs are opaque API strings. The planned implementation will use readable prefixes such as `c_` and `h_`, but clients must not depend on the ID generation format.

## Hold duration and expiry

- `HOLD_DURATION_SECONDS` is read from the backend environment and defaults to `600` seconds when absent.
- `HOLD_EXPIRY_POLL_INTERVAL_SECONDS` defaults to `5` seconds.
- `HOLD_EXPIRY_BATCH_SIZE` defaults to `100` holds per expiry pass.
- Each of these configuration values must be a positive whole number and should be rejected at startup if invalid rather than silently producing unsafe behavior.
- `expiresAt` is calculated using the current UTC clock in the hold-creation transaction. All timestamps in the system use UTC.
- The hosted background expiry worker periodically finds due `HELD` applications, marks them `EXPIRED`, and releases their seats in PostgreSQL transactions. The worker runs even when no user is interacting with the application.
- API operations will also perform a due-expiry check as a safety net before making a seat decision. This prevents an expired hold from being confirmed while the worker is between runs.
- Expiration must be reconciled exactly once as a state transition. A successful transition from `HELD` to `EXPIRED` releases that hold's seat once; retries must observe the changed status and must not release the seat again.
- Hold creation must reconcile due holds for the class before checking available capacity.
- Confirmation must reject a hold when `expiresAt <= currentUtcTime`, even if the background worker has not yet processed it. The status will be reconciled to `EXPIRED` by the worker or the next relevant API transaction.

## Duplicate applications

- An application in `HELD` or `CONFIRMED` state is considered active for the same student/class uniqueness rule.
- A second hold request for a student who already has a non-expired `HELD` application for the class returns `409 Conflict` with a clear problem-details error. The existing application remains available for confirmation or cancellation.
- A `CONFIRMED` application prevents another application for that student/class permanently, because a student cannot have multiple confirmed admissions for one class.
- `EXPIRED` and `CANCELLED` applications remain in history and do not block a later application for the same class.
- A PostgreSQL unique partial index and transactional checks will backstop this rule; frontend checks are only for user experience.

## Cancellation

- Cancellation is intended for an unconfirmed `HELD` application and releases its held seat exactly once.
- Cancellation changes the status to `CANCELLED`; it does not delete application history.
- Repeating cancellation for an already `CANCELLED` application is treated as idempotent and returns `204 No Content` for the owning student.
- Cancelling an `EXPIRED` or `CONFIRMED` application is rejected with `409 Conflict`. A separate confirmed-admission withdrawal workflow is outside the assignment contract.

## Confirmation and simulated payment

- `POST /holds/{holdId}/confirm` represents successful simulated admission-fee confirmation; there is no external payment provider or payment data model in this assignment.
- Confirmation locks the class row, verifies ownership, verifies `HELD` status, verifies that `expiresAt` is still in the future, decrements `heldSeats`, increments `confirmedSeats`, and changes the application to `CONFIRMED` in one transaction.
- Repeating confirmation for the same owning application after it is already `CONFIRMED` returns `200` with the same confirmed response and does not change counters.
- A hold that is `EXPIRED`, `CANCELLED`, or otherwise not owned by the requesting student cannot be confirmed.

## Error handling

- Expected invalid input, missing identity, not-found, ownership, duplicate-application, no-seat, and invalid-state cases return meaningful 4xx responses.
- Errors use an RFC 7807-style `application/problem+json` response with `type`, `title`, `status`, `detail`, `instance`, and a stable `code` where appropriate. Validation failures may additionally include an `errors` object.
- Unexpected failures are 500 responses and must not expose stack traces, credentials, or database internals to clients.

## Concurrency and persistence

- A class row is the serialization point for seat allocation and release. A transaction locks the class row before reading/updating seat counters and before changing related application state.
- All mutation operations use one consistent database locking order: acquire the class row lock first, then acquire the application/hold row lock. Expiry processing and normal API operations follow this same order; no mutation path may acquire these locks in reverse order.
- If a hold's class ID must first be discovered, use an initial non-locking lookup. Then lock the class row, re-read the hold by ID, and lock the hold row while still following the class-before-application order.
- Hold creation reconciles due holds before checking capacity. Confirmation rejects `expiresAt <= currentUtcTime`. Each hold can release its seat once, and seat counters must never become negative.
- Hold creation, confirmation, cancellation, and expiry release use the same locking discipline so that `heldSeats + confirmedSeats <= totalSeats` remains true under concurrent requests.
- PostgreSQL check constraints, foreign keys, and partial unique indexes provide defense in depth. The database remains authoritative; counters are not trusted from the client.
- PostgreSQL 18 uses a named Docker volume mounted at `postgres_data:/var/lib/postgresql`, the official PostgreSQL 18 image mount path. The legacy `/var/lib/postgresql/data` mount is not used. Application data and history therefore survive container restarts; container removal is not assumed to mean database deletion.
- All database timestamps are UTC.

## Contract ambiguities requiring approval

1. Whether the administrator should eventually require authentication, or remain intentionally open for the take-home UI.
2. Whether a duplicate hold request should return `409` as proposed, or be idempotent and return the existing hold.
3. Whether cancellation of an already cancelled hold should be idempotent as proposed.
4. Whether class names must be unique; the supplied contract does not require uniqueness, so the default is to allow duplicate names while IDs remain unique.
