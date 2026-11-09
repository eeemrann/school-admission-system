# Assumptions and open business decisions

This document makes decisions explicit where the supplied requirements do not fully define behavior. These are recommended defaults for implementation and should be approved by the project owner before the corresponding behavior is built.

## Identity and authorization

- No login or authentication system is required.
- `X-Student-Id` is required for hold creation, confirmation, cancellation, and the student's application list. It is treated as an opaque, trimmed, non-empty student registration identifier.
- The header is an assignment-level identity selector, not a security proof. The API must still enforce that a student can mutate only their own hold.
- Class creation is available to the administrator UI without a separate admin login because no admin authentication contract was supplied.

## Class data

- `totalSeats` must be a positive integer.
- A class name must be non-empty after trimming.
- The supplied contract contains class creation but no class update or deletion operation. Class capacity is therefore treated as immutable through the public API for this assignment.
- Class IDs and hold IDs are opaque API strings. The planned implementation will use readable prefixes such as `c_` and `h_`, but clients must not depend on the ID generation format.

## Hold duration and expiry

- `HOLD_DURATION_SECONDS` is read from the backend environment and defaults to 600 seconds when absent.
- The value must be a positive whole number and should be rejected at startup if it is invalid rather than silently producing unsafe behavior.
- `expiresAt` is calculated using a UTC clock in the hold-creation transaction.
- A hosted background expiry worker will periodically find due `HELD` applications, mark them `EXPIRED`, and release their seats in PostgreSQL transactions. The worker will run even when no user is interacting with the application.
- API operations will also perform a due-expiry check as a safety net before making a seat decision. This prevents an expired hold from being confirmed while the worker is between runs.
- Expiry is best-effort at the exact wall-clock boundary because a worker runs periodically, but confirmation must reject a hold as soon as its UTC `expiresAt` has passed. The status will be reconciled to `EXPIRED` by the worker or the next relevant API transaction.

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
- Hold creation, confirmation, cancellation, and expiry release use the same locking discipline so that `heldSeats + confirmedSeats <= totalSeats` remains true under concurrent requests.
- PostgreSQL check constraints, foreign keys, and partial unique indexes provide defense in depth. The database remains authoritative; counters are not trusted from the client.
- PostgreSQL uses a named Docker volume so applications and application history survive container restarts. Container removal is not assumed to mean database deletion.
- All database timestamps are UTC.

## Contract ambiguities requiring approval

1. Whether the administrator should eventually require authentication, or remain intentionally open for the take-home UI.
2. Whether a duplicate hold request should return `409` as proposed, or be idempotent and return the existing hold.
3. Whether cancellation of an already cancelled hold should be idempotent as proposed.
4. The desired expiry-worker polling interval and maximum batch size.
5. Whether class names must be unique; the supplied contract does not require uniqueness, so the default is to allow duplicate names while IDs remain unique.
6. Whether student IDs have a fixed format/length; the contract only supplies an example, so validation is limited to a safe non-empty identifier until the owner specifies a format.
