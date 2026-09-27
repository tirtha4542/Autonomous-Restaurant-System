# Project Status

## Document Purpose

This file tracks the current implementation state.

Unlike the other `.agent` architecture documents, this file is expected to change frequently.

Do not use this document to silently redefine architecture. Architectural changes belong in the appropriate document and/or an ADR.

## Current Phase

**Architecture / Repository Initialization**

The current objective is to establish:

- Product/domain boundaries
- Authorization model
- Operational flows
- Database ownership principles
- AI boundaries
- AWS/DevOps direction
- Repository structure

## Current Architectural State

### Confirmed

- Modular monolith first.
- Future microservice extraction is supported through domain boundaries.
- Organization is the primary tenant boundary.
- Authorization is capability/scope based.
- Backend is the security authority.
- Table sessions are first-class.
- Orders are separate from sessions.
- Kitchen is a separate domain.
- Payments are a separate sensitive domain.
- Realtime is not the source of truth.
- AI uses authorized tools/application services.
- AI does not access the database directly.
- PostgreSQL is the primary transactional database.
- AWS managed services are preferred initially.
- ECS/Fargate is the initial compute direction.
- Terraform is the infrastructure-as-code direction.
- pnpm + Turborepo is the monorepo direction.

## Repository Initialization

Status:

- [ ] Create repository root structure
- [ ] Create `.agent` architecture documents
- [ ] Create monorepo configuration
- [ ] Create API module skeleton
- [ ] Create frontend application skeletons
- [ ] Create AI/realtime/worker skeletons
- [ ] Create Terraform structure
- [ ] Create CI/CD structure
- [ ] Establish CODEOWNERS and contribution rules

## Product Implementation

Not yet implemented in this architecture initialization phase.

Future vertical slices should begin with the highest-priority approved product flow.

Suggested first vertical slice:

```text
QR
→ Table Session
→ Menu
→ Cart
→ Submit Order
→ Waiter Acceptance
→ Kitchen Queue
→ Realtime Update
```

This is a development sequencing suggestion, not a final product priority decision.

## Open Questions

Questions should be added here only when they materially block implementation.

Examples:

- Exact customer identity model: guest/session versus phone/email OTP.
- Exact payment providers.
- Final menu/product customization model.
- Exact staff assignment granularity.
- Subscription/billing requirements for organizations.
- Final realtime transport details.
- Final AI provider/model choices.
- Exact reporting/analytics scope.

## Change Management

When an architectural decision changes:

1. Update the appropriate `.agent` document.
2. Add or update an ADR when the decision is significant.
3. Update affected implementation documentation.
4. Update this status file only for implementation/state tracking.

## Current Owner Model

Architecture should be governed centrally while implementation is delegated by domain/team ownership.

The architecture owner is responsible for:

- Boundaries
- Contracts
- Authorization model
- Integration rules
- Architecture reviews
- Significant ADRs

Developers are responsible for implementing within those boundaries.
