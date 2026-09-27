# Architectural Rules

These rules are non-negotiable unless changed through an explicit architecture decision record.

## 1. Modular Monolith First

The initial business system is a modular monolith.

Do not introduce distributed microservices without a documented reason.

## 2. Domain Ownership

Every business domain owns its own business rules and persistence responsibilities.

Do not allow one domain to directly manipulate another domain's database structures.

## 3. No Global Layer Dumping

Do not create global folders such as:

```text
src/controllers/
src/services/
src/repositories/
```

Business code belongs to its domain.

## 4. Authorization Is Centralized

Authorization must be evaluated by the backend.

The frontend is not a security boundary.

## 5. Capability Over Hard-Coded Roles

Use permissions and scopes as the authoritative model.

Roles may bundle permissions for convenience.

## 6. Tenant Isolation

Organization boundaries must be enforced consistently across API, persistence, background jobs, realtime, analytics, and AI.

Never trust tenant identifiers supplied only by clients.

## 7. AI Cannot Bypass the Platform

Never:

```text
AI → SQL → Database
```

Use:

```text
AI → Tool Gateway → Authorization → Application → Domain → Database
```

## 8. Domain Must Not Depend on AWS

Do not import AWS SDK implementations directly into domain logic.

Use ports/interfaces and infrastructure adapters.

## 9. Realtime Is Not Source of Truth

WebSocket messages are delivery mechanisms.

Persistent business state lives in the application/database.

## 10. Use Events for Loose Coupling

Use domain/application events and explicit contracts for cross-domain workflows.

Avoid direct circular domain dependencies.

## 11. Payment Isolation

Payment provider details belong behind payment interfaces/adapters.

Sensitive payment operations require strong authorization and auditability.

## 12. QR Security

QR codes should resolve through opaque tokens.

Do not expose sensitive internal identifiers in public QR URLs.

## 13. Explicit State Transitions

Order, payment, and session state changes must be controlled by domain rules.

Do not allow arbitrary status mutation.

## 14. No Premature Infrastructure Complexity

Do not introduce Kafka, service mesh, Kubernetes, multi-region deployment, or GPU infrastructure unless a documented requirement justifies it.

## 15. Managed AWS Services First

Prefer managed AWS services where they reduce operational complexity.

## 16. Secrets

Never commit secrets, credentials, provider keys, or production environment values.

Use AWS Secrets Manager/SSM or the appropriate secret mechanism.

## 17. Observability

Production operations must provide enough structured context to trace business activity.

Useful fields include:

```text
requestId
organizationId
branchId
userId
action
resourceId
status
```

## 18. Audit Sensitive Actions

Important mutations and privileged actions should be auditable.

## 19. API Contracts

API contracts should be explicit and versionable.

Do not silently change externally consumed contracts.

## 20. Vertical Delivery

Prefer complete vertical slices over building large disconnected layers.

## 21. Architecture Changes

Significant architectural changes require an ADR under:

```text
.agent/ADR/
```

## 22. Avoid Accidental Coupling

A module should not reach into another module's internals.

If a future service extraction would require rewriting unrelated domains, the current boundary is probably too weak.

## 23. Minimal Dependencies

Add dependencies only when they solve a real requirement.

## 24. No Invented Product Scope

Developers must not silently add features that are not approved by product/architecture documentation.

## 25. Security by Default

New endpoints, jobs, tools, realtime subscriptions, and integrations must define their authorization and tenant scope before implementation.
