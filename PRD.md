# Time-Off Microservice — PRD

**Project:** Wizdaa Take-Home Assessment  
**Stack:** NestJS · SQLite · REST  
**Constraint:** Agentic development — no manual code, rigorous TRD + tests are the deliverable

---

## 1. Project Understanding

### What this is
A standalone NestJS microservice that owns the lifecycle of time-off requests for ReadyOn employees. It does **not** replace the HCM (Workday/SAP); it sits in front of it. The HCM is the authoritative source of truth for leave balances. ReadyOn is the employee-facing interface.


### The core problem
Two systems can modify the same balance independently:
- ReadyOn: employee submits a request → debit balance
- HCM: work anniversary, year-start reset → credit/overwrite balance

These can conflict. The microservice must keep both in sync without corruption, double-debits, or stale cache serving as ground truth.

### Key constraints from the brief
- Balances are **per-employee per-location** (`employeeId + locationId` is the composite key)
- HCM has a **real-time API** (get/set a single balance)
- HCM has a **batch endpoint** (pushes full corpus to ReadyOn — this is a webhook/ingestion endpoint we must expose)
- HCM may or may not return errors on invalid requests — **we cannot fully trust it; be defensive**
- Mock HCM server required as part of the test suite

---

## 2. Actors & Use Cases

| Actor | Primary Need |
|---|---|
| Employee | See current balance; submit request; get instant accept/reject |
| Manager | Approve/reject pending requests with confidence the balance is valid |
| HCM System | Push batch balance updates; receive debit/credit calls from us |
| Scheduler (internal) | Periodic sync to catch drift between our local cache and HCM |

---

## 3. Data Model

### `balance` table
```
employeeId    TEXT    NOT NULL
locationId    TEXT    NOT NULL
leaveType     TEXT    NOT NULL   -- e.g. "annual", "sick"
balance       REAL    NOT NULL   -- days remaining
hcmVersion    TEXT               -- ETag/version from HCM for optimistic locking
lastSyncedAt  DATETIME NOT NULL
PRIMARY KEY (employeeId, locationId, leaveType)
```

### `time_off_request` table
```
id            TEXT PRIMARY KEY   -- UUID
employeeId    TEXT NOT NULL
locationId    TEXT NOT NULL
leaveType     TEXT NOT NULL
startDate     DATE NOT NULL
endDate       DATE NOT NULL
days          REAL NOT NULL      -- computed; stored for audit
status        TEXT NOT NULL      -- PENDING | APPROVED | REJECTED | CANCELLED
requestedAt   DATETIME NOT NULL
resolvedAt    DATETIME
managerId     TEXT               -- who approved/rejected
hcmSubmitted  BOOLEAN DEFAULT 0  -- whether we've written to HCM
hcmError      TEXT               -- last HCM error if any
```

### `sync_log` table
```
id            TEXT PRIMARY KEY
type          TEXT    -- BATCH | REALTIME | DRIFT_CORRECT
triggeredBy   TEXT    -- scheduled | webhook | request
status        TEXT    -- SUCCESS | PARTIAL | FAILED
detail        TEXT    -- JSON blob
createdAt     DATETIME
```

---

## 4. Feature Breakdown (Sprint-Wise)

---

### Sprint 1 — Core Balance CRUD + HCM Real-Time Integration

**Goal:** Employees and managers can read balances. The service fetches from HCM and caches locally.

#### F1.1 — Get Balance
- `GET /balances/:employeeId/:locationId`
- Returns all leave types for the employee at a location
- Strategy: read local cache first; if `lastSyncedAt` > threshold (configurable, default 5 min), serve cache; else fetch from HCM real-time API, update cache, return
- Response includes `lastSyncedAt` so client knows freshness

#### F1.2 — Force Refresh Balance
- `POST /balances/:employeeId/:locationId/sync`
- Bypasses cache, hits HCM real-time API, updates local record
- Returns updated balance
- Use case: manager clicks "refresh" before approving

#### F1.3 — HCM Adapter (internal module)
- `HcmAdapter` service wraps all outbound HCM calls
- Methods: `getBalance(employeeId, locationId, leaveType)`, `debitBalance(...)`, `creditBalance(...)`
- All calls time out in 5s; on timeout, throw `HcmUnavailableException`
- Parse HCM errors and normalize into internal error codes

**Acceptance criteria:**
- Balance read returns 200 with cached data within 50ms on cache hit
- Balance read hits HCM and caches on miss or stale cache
- Force sync always calls HCM

---

### Sprint 2 — Time-Off Request Lifecycle

**Goal:** Employees submit requests; managers approve/reject; HCM is updated accordingly.

#### F2.1 — Submit Request
- `POST /requests`
- Body: `{ employeeId, locationId, leaveType, startDate, endDate }`
- Logic (in order):
  1. Calculate `days` (excluding weekends — configurable)
  2. Fetch current balance (force-sync from HCM)
  3. **Local pre-check:** `balance >= days` — reject immediately if not
  4. Create request with status `PENDING`, persist
  5. Return 201 with request object
- Do **not** debit HCM at submit time; only debit on approval

#### F2.2 — Approve Request
- `PATCH /requests/:id/approve`
- Body: `{ managerId }`
- Logic:
  1. Load request, assert status = PENDING
  2. Force-sync balance from HCM (re-validate, not just cache)
  3. Local check: `balance >= days`
  4. Call `HcmAdapter.debitBalance(...)` 
  5. If HCM returns error → set `hcmError`, return 422 with HCM error detail
  6. If HCM succeeds OR if HCM gives no error (defensive: assume success), update local balance, set `hcmSubmitted = true`, set status = APPROVED
  7. Return 200

**Defensive behavior on HCM silence:** If HCM returns 2xx but no confirmation of new balance, re-fetch balance after 2s and update cache.

#### F2.3 — Reject Request
- `PATCH /requests/:id/reject`
- Body: `{ managerId, reason? }`
- Set status = REJECTED; no HCM call needed
- Return 200

#### F2.4 — Cancel Request (by employee)
- `PATCH /requests/:id/cancel`
- Only allowed if status = PENDING
- If status = APPROVED and within grace window (configurable, default 24h): call `HcmAdapter.creditBalance(...)`, set status = CANCELLED
- If HCM credit fails: log error, flag for manual review, still set status = CANCELLED locally

#### F2.5 — List Requests
- `GET /requests?employeeId=&status=&page=&limit=`
- Returns paginated list of requests

**Acceptance criteria:**
- Cannot approve if balance insufficient at HCM
- Cannot approve a non-PENDING request
- Cancellation within grace window attempts HCM credit and logs result

---

### Sprint 3 — Batch Sync + Drift Detection

**Goal:** Handle HCM-initiated balance updates (anniversary, year-reset) without corrupting in-flight requests.

#### F3.1 — Batch Ingest Endpoint
- `POST /hcm/batch`
- Authenticated via shared secret header (`X-HCM-Secret`)
- Body: array of `{ employeeId, locationId, leaveType, balance, version }`
- Logic:
  1. For each record, check if there is a PENDING request for that employee/location/leaveType
  2. If PENDING requests exist: store the incoming balance but flag `pendingConflict = true`; do not blindly overwrite — manager must re-validate on next approval
  3. If no PENDING: upsert balance directly
  4. Write a `sync_log` record of type BATCH
- Return 202 with summary: `{ updated, skipped, conflicts }`

#### F3.2 — Scheduled Drift Detection
- Cron job (configurable interval, default 1h)
- For each balance in local DB: fetch from HCM real-time API
- If local != HCM (beyond epsilon, configurable): log drift, overwrite local with HCM value, emit a `balance.drift` internal event
- Drift events are logged in `sync_log` for audit
- If drift detected on a record with PENDING request: emit alert (log + optional webhook)

#### F3.3 — Sync Status Endpoint
- `GET /hcm/sync-status`
- Returns: last batch sync time, last drift check time, count of drifted records since last check, any unresolved conflicts

**Acceptance criteria:**
- Batch ingest with 1000 records completes under 10s
- Pending conflict is flagged and not silently overwritten
- Drift job logs every discrepancy

---

### Sprint 4 — Security, Observability, Mock HCM Server

**Goal:** Auth, rate limiting, structured logging, and the mock HCM for tests.

#### F4.1 — Auth Middleware
- Bearer token validation on all `/requests` and `/balances` routes
- Role claim in JWT: `employee` | `manager` | `hcm_system`
- Route guards: managers-only for approve/reject; `hcm_system` only for batch ingest
- Employees can only read/submit/cancel their own requests (enforce `sub === employeeId`)

#### F4.2 — Rate Limiting
- Global: 100 req/min per IP
- `/requests` POST: 10 req/min per employeeId
- Use NestJS `@nestjs/throttler`

#### F4.3 — Structured Logging
- Every request: `requestId`, `employeeId`, `action`, `durationMs`, `status`
- Every HCM call: `hcmCallId`, `method`, `durationMs`, `hcmStatus`, `error?`
- Use Pino or NestJS built-in logger with JSON output

#### F4.4 — Mock HCM Server
- Separate NestJS app (or express) in `/mock-hcm` directory
- Exposes:
  - `GET /hcm/balance/:employeeId/:locationId/:leaveType` → returns seeded balance; simulates latency (50–200ms random)
  - `POST /hcm/balance/debit` → debits balance; returns error if insufficient (configurable: can toggle "unreliable mode" where it randomly returns 200 without actually checking)
  - `POST /hcm/balance/credit` → credits balance
  - `POST /hcm/balance/batch-push` → admin endpoint to trigger a batch push to our service (simulates work anniversary event)
- State persisted in-memory; reset endpoint for tests: `POST /hcm/_reset`
- Unreliable mode toggle: `POST /hcm/_config { unreliable: true }` — for testing our defensive logic

**Acceptance criteria:**
- All routes reject unauthorized requests with 401
- Managers cannot submit requests; employees cannot approve
- Mock HCM resets cleanly between test suites

---

## 5. API Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/balances/:employeeId/:locationId` | employee/manager | Get balance (cached) |
| POST | `/balances/:employeeId/:locationId/sync` | manager | Force HCM sync |
| POST | `/requests` | employee | Submit request |
| GET | `/requests` | employee/manager | List requests |
| PATCH | `/requests/:id/approve` | manager | Approve |
| PATCH | `/requests/:id/reject` | manager | Reject |
| PATCH | `/requests/:id/cancel` | employee | Cancel |
| POST | `/hcm/batch` | hcm_system | Ingest batch update |
| GET | `/hcm/sync-status` | manager | Sync health |

---

## 6. Test Strategy

Tests are the primary deliverable. Three layers:

### Unit Tests (Jest)
- `BalanceService`: cache hit/miss logic, staleness threshold, drift epsilon comparison
- `RequestService`: day calculation, status machine transitions (invalid transitions must throw), local pre-check logic
- `HcmAdapter`: error normalization, timeout handling, retry logic

### Integration Tests (Jest + Supertest + Mock HCM)
- Full request lifecycle: submit → approve → verify HCM debit was called
- Double-approval prevention
- Insufficient balance rejection at both submit and approve stages
- Batch ingest: with and without PENDING conflicts
- Cancellation with HCM credit; cancellation with HCM credit failure
- Drift detection: seed local cache with stale value, trigger drift job, assert correction logged

### Adversarial / Defensive Tests
- HCM returns 200 on debit with no balance confirmation → assert we re-fetch
- HCM returns 500 on debit after PENDING request → assert request stays PENDING, error logged
- HCM in unreliable mode → assert our balance check still blocks over-spend
- Concurrent approval of two requests against the same balance → assert only one succeeds (SQLite transaction test)
- Batch ingest with conflicting data mid-PENDING request → assert conflict flag set

### Coverage Target
- Minimum 85% line coverage enforced in CI (`jest --coverage --coverageThreshold`)

---

## 7. Out of Scope

- Multi-leave-type in a single request (each request = one leave type)
- UI / frontend
- Email/notification delivery (log events only)
- Production auth (JWT secret via env var is sufficient for assessment)
- Multi-instance/distributed locking (SQLite is single-process; noted as a scale-out limitation in TRD)

---

## 8. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| HCM debit call succeeds but we crash before persisting | Wrap debit + local update in a try/catch; if local update fails, attempt HCM credit rollback; log unresolved state |
| HCM returns 200 without checking balance (unreliable mode) | Always do local pre-check before calling HCM; treat HCM as a secondary validator |
| Batch update overwrites balance needed by PENDING request | `pendingConflict` flag; force re-sync on next approval action |
| SQLite concurrent writes under load | Use WAL mode; serialize balance mutations via NestJS queue or mutex per `employeeId+locationId` |
| Stale cache served to manager approving a request | Always force-sync before approve action (not optional) |