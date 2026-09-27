# Database Architecture

## Primary Database

The primary transactional database is PostgreSQL.

Prisma is the initial ORM/data-access technology.

The database is authoritative for persistent business state.

## Ownership Principle

Each domain owns the data needed for its business rules.

Conceptually:

```text
Identity
Authorization
Organizations
Restaurants
Branches
Staff
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
```

The exact physical schema is an implementation concern and must be derived from domain requirements.

## Multi-Tenancy

Organization is the primary tenant boundary.

Tenant-owned data must be associated with the appropriate organization context, directly or through an explicit ownership relationship.

Every query path must preserve tenant isolation.

Do not rely on frontend filtering for tenant security.

## Core Relationships

Conceptually:

```text
Organization
  └── Restaurant
       └── Branch
            ├── Tables
            ├── Staff Assignment
            ├── Menu
            ├── Customer Session
            ├── Table Session
            │    ├── Order
            │    │    └── Order Item
            │    └── Payment
            └── Kitchen Ticket
```

This is a conceptual model, not a finalized schema.

## Table Sessions

Table sessions are first-class entities.

A single table session can contain multiple orders:

```text
Table Session
├── Order
├── Order
├── Order
└── Payment
```

This prevents the system from incorrectly assuming one order equals one customer visit.

## Orders

Orders and order items should support explicit state transitions.

The initial conceptual lifecycle is:

```text
DRAFT
→ SUBMITTED
→ ACCEPTED
→ KITCHEN_QUEUE
→ PREPARING
→ READY
→ SERVED
```

Rejection/cancellation paths must be explicitly defined by domain rules.

## Kitchen Data

Kitchen should own kitchen-specific operational data such as tickets, stations, and preparation state where applicable.

Order data should not be duplicated unnecessarily.

## Payment Data

Payment is a sensitive domain.

Provider-specific data should be isolated from general order/session records.

Avoid storing sensitive payment credentials that should remain with a provider.

## Audit Data

Audit records should be append-oriented and capture enough context to reconstruct important actions.

Potential fields:

```text
actorType
actingUserId
aiAgentId
organizationId
restaurantId
branchId
action
resourceType
resourceId
before
after
authorizationResult
timestamp
source
```

Final schema should be defined during implementation.

## Outbox

Reliable event publication should use an outbox pattern where required:

```text
Transaction
├── Domain state
└── Outbox record
       ↓
Commit
       ↓
Worker
       ↓
Event consumers
```

This prevents a successful database transaction from being separated from its required asynchronous event publication.

## Database Rules

- No public database exposure.
- Use migrations.
- Review destructive migrations carefully.
- Preserve tenant boundaries.
- Index according to real query patterns.
- Avoid premature denormalization.
- Do not let domain code depend on Prisma implementation details.
- Keep transactions around business invariants.
- Use idempotency for retryable external operations where appropriate.

## Future Scaling

The initial database should remain a shared PostgreSQL deployment.

If scale or isolation requirements later justify separate databases/services, extraction should follow established domain ownership boundaries.
