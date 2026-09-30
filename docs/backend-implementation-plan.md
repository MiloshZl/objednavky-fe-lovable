# Backend implementation plan

## Phase 1 – foundation
- initialize Node.js project
- configure TypeScript or JS strict mode
- add env config, logger, timezone and security base
- add MySQL connection pool, health check
- add request id middleware and global error handler

## Phase 2 – auth and session
- login endpoint
- session creation
- logout endpoint
- `authRequired` guard
- `authorize` guard
- session revocation by user and admin
- active devices overview

## Phase 3 – core domain
- users management
- therapists management
- patients create/update/search
- insurers and contract periods
- patient identity exception logic

## Phase 4 – schedule and availability
- template loading and merge logic
- override logic
- holiday and weekend filtering
- 15-minute slot generation
- check if slot fits inside working interval

## Phase 5 – reservations
- create reservation transaction
- batch reservation creation
- excuse and cancel flows
- conflict check and lock strategy
- seventh visit warning calculation
- reservation event creation

## Phase 6 – admin
- admin dashboard for users
- revoke device sessions
- revoke all sessions for selected user
- audit log view
- export or read permissions for audit data

## Phase 7 – hardening and testing
- brute-force protection
- CSRF validation for cookie auth
- end-to-end negative tests
- race-condition tests with concurrent writes
- audit consistency tests

## Implementation patterns
### Controllers
- validate request input
- call service
- map result to response

### Services
- domain logic and business rules
- authorization checks through explicit policy helpers
- transaction execution

### Repositories
- data access only
- no business logic

### Middleware
- `authRequired`
- `requireRole('ADMIN')`
- `requireScope('PATIENT_READ')` where applicable
- `validateBody` / `validateQuery`
- `handleErrors`

## Key business decisions to enforce in code
- only 45 or 60 minute durations
- slots by 15-minute starts
- weekend and holiday unavailable
- cancel/excuse do not count to seventh visit
- patient insurer snapshot is stored on reservation
- admin-only token handover and revocation

## Acceptance criteria for backend completion
- login works only with valid token hash and active account
- no endpoint is accessible without server-side authorization
- no cizí access by changing URL id
- all writes use transactions and audit
- all security tests pass with negative scenarios
- reservation conflicts are prevented even under concurrency
