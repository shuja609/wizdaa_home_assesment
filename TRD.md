# Time-Off Microservice — Technical Requirements Document (TRD)

## 1. Executive Summary
This document outlines the technical architecture, design patterns, and implementation strategies for the ReadyOn Time-Off Microservice. The service acts as an **Anti-Corruption Layer (ACL)** between employee-facing interfaces and external **Human Capital Management (HCM)** systems.

## 2. Architectural Design

### 2.1 Pattern: Anti-Corruption Layer (ACL)
To prevent HCM-specific API schemas and behaviors from "bleeding" into our domain logic, the `HcmAdapter` isolates all external communication. This ensures that if the HCM provider changes (e.g., from Workday to SAP), only the adapter requires modification.

### 2.2 Pattern: Cache-Aside Consistency
The service maintains a local SQLite database to cache balances.
*   **Reads**: Fetch from local cache. If stale (> 5 mins), sync from HCM.
*   **Writes**: Perform atomic "Read-Modify-Write" by force-syncing from HCM, validating locally, and then updating both HCM and local cache.
*   **Webhooks**: Handle large batch pushes from HCM with conflict detection for PENDING requests.

### 2.3 Resilience & Defensive Strategy
- **Defensive Silence Handling**: If HCM returns 2xx but omits the current balance, the service waits 2s and re-fetches to verify state.
- **Floating-Point Precision**: All day calculations and comparisons use a $0.001$ epsilon to avoid IEEE 754 precision issues.
- **Grace Window**: Allows cancellations of approved requests within 24 hours via an automated HCM rollback (credit) mechanism.

## 3. Data Integrity & Concurrency

### 3.1 SQLite Concurrency (WAL Mode)
To handle concurrent reads and writes without "Database is locked" errors, the database is configured in **Write-Ahead Logging (WAL)** mode. This allows readers to continue without being blocked by writers.

### 3.2 Balance Serialization (In-Memory Mutex)
To prevent race conditions during the "Verify -> Debit -> Update Cache" flow, the service implements a **striped mutex** keyed by `employeeId`. This ensures that two managers cannot simultaneously approve requests that together exceed the available balance.

## 4. Security & Observability

### 4.1 Identity & Access
- **JWT Auth**: Standard Bearer token authentication.
- **RBAC**: 
    - `employee`: Own request management only.
    - `manager`: Operational oversight and resolution.
    - `hcm_system`: Webhook ingestion only (Shared Secret verification).
- **Rate Limiting**: Tiered throttling (Global + Per-Employee) to prevent brute-force and resource exhaustion.

### 4.2 Logging
- **Structured Output**: JSON logging via **Pino** for ingestion into ELK/Datadog.
- **Correlation**: Every HCM call is logged with its duration and outcome for vendor performance auditing.

## 5. Testing Strategy
A 3-tier testing pyramid:
1.  **Unit**: Business logic (day calculation, staleness logic).
2.  **Integration**: Multi-service flows using a standalone **Mock HCM Server**.
3.  **Adversarial**: Stress-testing concurrency, timeouts, and unreliable HCM modes.

## 6. Limitations & Future Scale
- **Vertical Scaling**: Currently optimized for single-instance deployment (SQLite). Scaling to K8s/Multiple pods would require migrating to a distributed lock (Redis) and a client-server DB (Postgres).
- **Notification**: Events are emitted internally (`EventEmitter2`) but require an external worker to connect to SMTP/Slack providers.
