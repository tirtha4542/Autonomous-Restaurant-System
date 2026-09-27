# Architecture

## Architectural Style

The platform uses a domain-oriented modular monolith with explicit boundaries and future microservice extraction capability.

The initial deployment must not become a distributed microservice system prematurely.

```text
Frontend
  ↓
API
  ↓
Authorization
  ↓
Application
  ↓
Domain
  ↓
Infrastructure
  ↓
Database / AWS
```

## Runtime Applications

```text
apps/
├── api/
├── realtime/
├── worker/
└── ai/
```

### API

Primary business API and application orchestration layer.

### Realtime

WebSocket/realtime delivery, presence, subscriptions, and live operational updates.

Realtime is not the source of truth.

### Worker

Asynchronous jobs, event consumers, notifications, outbox processing, analytics workloads, and background operations.

### AI

Agent runtime, context building, tool execution, policy enforcement, provider integration, and AI audit.

AI is a client of the platform's authorized capabilities, not a privileged database client.

## Business Domains

The initial API modular monolith contains:

```text
Identity
Authorization
Organizations
Restaurants
Branches
Staff
Floors
Tables
Menus
Customer Sessions
Table Sessions
Orders
Kitchen
Payments
Notifications
Audit
Analytics
AI
```

Each domain owns its business rules and persistence boundary.

## Domain Structure

A major domain follows this pattern:

```text
<domain>/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── <domain>.module.ts
```

### Domain Layer

Contains business concepts and rules:

- Entities
- Value objects
- Enums
- Domain events
- Domain rules

The domain layer must not depend directly on AWS SDKs, HTTP infrastructure, Prisma implementation details, or external providers.

### Application Layer

Coordinates use cases:

- Commands
- Queries
- Application services

This layer invokes domain behavior and infrastructure ports/adapters through explicit boundaries.

### Infrastructure Layer

Contains implementation details:

- Persistence
- External adapters
- Provider integrations

### Presentation Layer

Exposes capabilities through:

- HTTP
- Realtime interfaces

Presentation code must not contain core business rules.

## Cross-Domain Communication

Avoid direct cross-domain database manipulation.

Prefer:

```text
Domain A
  ↓
Application interface / event / contract
  ↓
Domain B
```

Example:

```text
Order accepted
  ↓
OrderAccepted event
  ↓
Kitchen consumes event
  ↓
Kitchen Ticket created
```

The exact transport can evolve without changing the domain ownership model.

## Event-Driven Boundary

Business state changes should support an outbox pattern where reliability matters:

```text
DB transaction
├── Business state change
└── Outbox event
        ↓
      Commit
        ↓
   Worker / Event Bus
        ↓
Consumers
```

Important events include:

- OrderSubmitted
- OrderAccepted
- OrderRejected
- OrderStarted
- OrderItemReady
- OrderReady
- OrderServed
- PaymentStarted
- PaymentCompleted
- TableSessionClosed

## Realtime Boundary

REST/HTTP is used for commands and queries.

WebSocket/realtime is used to notify clients about state changes.

```text
Business command
  ↓
API/domain
  ↓
Database + event
  ↓
Realtime publisher
  ↓
Customer / Staff UI
```

Clients must not treat a realtime message as authoritative state without validating against the API where necessary.

## Control Plane and Data Plane

### Control Plane

Responsible for platform-level concerns:

- Organizations
- Subscriptions/plans
- Platform administration
- Global configuration
- Tenant provisioning
- Feature flags

### Data Plane

Responsible for organization operational data:

- Restaurants
- Branches
- Staff
- Tables
- Menus
- Sessions
- Orders
- Kitchen
- Payments
- Operational AI

These concepts must remain distinguishable in the architecture.

## Future Extraction

Potential future service boundaries include:

```text
Orders
Payments
Kitchen
Notifications
Realtime
Analytics
AI
```

Extraction should happen only when operational or organizational reasons justify it.

The modular monolith must make extraction possible without allowing accidental coupling.
