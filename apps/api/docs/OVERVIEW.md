# Restaurant Platform — Overview

## Purpose

This project is a multi-tenant SaaS platform for restaurants and bars to manage QR-based customer ordering and in-venue operations.

The initial product flow is:

QR code → customer session → menu → cart → simple email/phone number verification & name collect -> order → waiter acceptance/rejection → kitchen preparation → waiter service → payment → session closure.

The platform is designed as a production-grade system with clear domain boundaries, capability-based authorization, realtime operations, asynchronous processing, and an AI layer that uses the same authorized application capabilities as human users.

## Product Surfaces

### Customer

A mobile-first web experience accessed through a table QR code.

Core capabilities:

- Resolve a table from an opaque QR token.
- Start or join a customer/table session.
- Browse the branch menu.
- Build a cart.
- Verify customer identity with a phone number or email address.
- Submit orders.
- See order status.
- Receive realtime updates.
- Request/pay the bill where supported.

### Staff

A workflow-oriented operational interface for staff such as:

- Waiter
- Kitchen staff
- Cashier
- Bartender
- Manager

Staff access is capability-driven. A person's effective access depends on their assigned permissions and scopes, not merely on a hard-coded role name.

### Administration

An administrative interface for organization-level and branch-level management:

- Organization
- Restaurant
- Branch
- Tables
- Menu
- Staff
- Permissions
- Configuration
- Reports

## Business Hierarchy

```text
Platform Owner
└── Organization
    └── Restaurant
        └── Branch
            ├── Tables
            ├── Staff
            ├── Menu
            ├── Customer Sessions
            ├── Table Sessions
            ├── Orders
            ├── Kitchen
            └── Payments
```

Business hierarchy and authorization are intentionally separate concepts.

## Architectural Direction

The initial system is a domain-oriented modular monolith.

It should be deployed as a small number of runtime applications, while keeping business domains internally isolated enough to extract later.

The guiding principle is:

> Monolith in deployment, modular in architecture.

## Primary Architectural Goals

- Clear business-domain ownership.
- Strong tenant isolation.
- Capability-based authorization.
- Explicit resource scopes.
- Backend as the security authority.
- Realtime operational workflows.
- Reliable asynchronous processing.
- Auditable sensitive actions.
- AI that cannot bypass authorization.
- Managed AWS infrastructure.
- Production observability.
- Future microservice extraction without rewriting domain boundaries.

## Initial Technology Direction

- TypeScript
- NestJS
- PostgreSQL
- Drizzle
- Redis/Valkey
- SQS/EventBridge where appropriate
- AWS ECS/Fargate
- RDS PostgreSQL
- ElastiCache/Valkey
- S3
- CloudFront/WAF
- Route 53
- Secrets Manager/SSM
- Terraform
- GitHub Actions
- pnpm
- Turborepo

Technology choices may evolve through documented ADRs.
