# Time-Off Microservice — Wizdaa Assessment

A standalone NestJS microservice designed to manage the lifecycle of employee time-off requests. It acts as an intelligent gateway to an external Human Capital Management (HCM) system, providing caching, conflict resolution, and defensive synchronization.

## 🚀 Overview

ReadyOn employees use this service to view leave balances and submit time-off requests. The service ensures data integrity by synchronizing local records with the HCM (the authoritative source of truth) using both real-time APIs and batch ingestion.

### Key Features
- **Sprint 1 [DONE]**: Core Balance CRUD with real-time HCM sync and local SQLite caching.
- **Sprint 2 [DONE]**: Full request lifecycle (Submit, Approve, Reject, Cancel) with defensive balance validation and working-day calculations.
- **Sprint 3 [DONE]**: Batch ingestion from HCM, defensive pending conflict detection, and scheduled drift detection/auto-correction.
- **Sprint 4 [DONE]**: JWT-based security, rate limiting, and a Mock HCM server for testing.

## 🛠️ Tech Stack
- **Framework**: NestJS
- **Database**: SQLite (via TypeORM)
- **Language**: TypeScript
- **Testing**: Jest & Supertest
- **Logging**: Pino

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

### Running the App
```bash
# development mode
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

### Running Tests
```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# coverage
npm run test:cov
```

## 📂 Project Structure
- `src/database/entities`: TypeORM entities for `Balance`, `TimeOffRequest`, and `SyncLog`.
- `src/hcm`: HCM Adapter and integration logic (Upcoming).
- `src/balances`: Balance management and caching (Upcoming).
- `src/requests`: Time-off request lifecycle (Upcoming).
- `mock-hcm`: Standalone mock server for integration testing (Upcoming).

## 📄 Documentation
- [PRD (Product Requirements Document)](file:///e:/Work/shuja/wizdaa_home_assesment/PRD.md)
- [Implementation Plan](file:///C:/Users/HP%20450%20G%209/.gemini/antigravity/brain/5b4d571c-a617-4544-97e1-d5a436f3c295/implementation_plan.md)
- [Walkthrough](file:///C:/Users/HP%20450%20G%209/.gemini/antigravity/brain/5b4d571c-a617-4544-97e1-d5a436f3c295/walkthrough.md)

## ⚖️ License
This project is licensed under the MIT License.
