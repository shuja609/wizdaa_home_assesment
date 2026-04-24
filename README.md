# 🌴 Time-Off Microservice

[![NestJS](https://img.shields.io/badge/framework-NestJS-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)]()
[![Code Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen?style=flat-square)]()

A high-resilience, production-ready microservice for managing employee time-off requests. This service acts as a sophisticated **Anti-Corruption Layer (ACL)** between internal application logic and external **Human Capital Management (HCM)** systems, ensuring data integrity through defensive synchronization and local caching.

---

## 🚀 Key Features

- **Robust Request Lifecycle**: Full support for submission, manager approval, rejection, and employee-led cancellation with automated grace-period enforcement.
- **Intelligent HCM Integration**: Real-time balance verification and debit/credit operations with fallback mechanisms for HCM downtime.
- **Advanced Synchronization**: Scheduled drift detection and large-scale batch ingestion logic to ensure the local cache remains a reliable mirror of the HCM truth.
- **Security First**: 
  - **RBAC**: Strict Role-Based Access Control (Employee vs. Manager).
  - **JWT Auth**: Secure identity verification.
  - **Throttling**: Multi-tier rate limiting (Global + Per-Employee) to prevent API abuse.
- **Observability**: Structured JSON logging via **Pino** for high-performance traceability and correlation.

---

## 🏗️ Core Architecture

The service is built on several key design pillars:

1.  **Anti-Corruption Layer (ACL)**: The `HcmAdapter` isolates the rest of the application from external HCM API changes and network instabilities.
2.  **Cache-Aside Pattern**: Employee balances are cached locally in SQLite via TypeORM, allowing for high availability even when upstream services are unreachable.
3.  **Defensive Programming**: Every transaction (Approval/Cancellation) involves a mandatory "Pre-check" against real-time HCM data before persisting local state.

---

## 🛠️ Tech Stack

- **Core**: NestJS (v10+), TypeScript
- **Persistence**: SQLite, TypeORM
- **Security**: @nestjs/passport, JWT, @nestjs/throttler
- **Observability**: nestjs-pino, pino-pretty
- **Testing**: Jest, Supertest

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18.x or later)
- npm (v9.x or later)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/shuja609/wizdaa_home_assesment.git
    cd wizdaa_home_assesment
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    ```bash
    cp .env.example .env
    ```
    *Edit `.env` to configure your `JWT_SECRET` and `HCM_API_URL`.*

---

## 🚦 Execution & Quality Control

### Running the Application
```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Testing Suite
We utilize a multi-paradigm testing strategy covering **Functional, Negative, Edge, Boundary, and Validation** cases.

```bash
# Comprehensive Unit tests
npm run test

# End-to-End (E2E) integration tests
npm run test:e2e

# Generate Coverage Report
npm run test:cov
```

### Code Quality Guards
```bash
# Static analysis (ESLint)
npm run lint

# TypeScript strict type checking
npx tsc --noEmit
```

---

## 📂 Project Structure

```text
├── src
│   ├── balances      # Balance management & HCM synchronization logic
│   ├── common        # Shared guards, decorators, and date utilities
│   ├── database      # TypeORM Entities (Balance, TimeOffRequest, SyncLog)
│   ├── hcm           # Anti-Corruption Layer / External API Adapters
│   ├── requests      # Time-off request business logic & flow
│   └── main.ts       # Application entry point
├── test              # E2E test suites (App, Requests, Balances, Sync, Adversarial)
├── mock-hcm          # Standalone Mock HCM server for integration testing
└── PRD.md            # Product Requirements Documentation
```

---

## 📄 Documentation & Links

- **[Product Requirements Document (PRD)](file:///e:/Work/shuja/wizdaa_home_assesment/PRD.md)**: Detailed feature specifications.


---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.
