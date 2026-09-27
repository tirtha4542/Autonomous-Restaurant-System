# Authorization

## Core Model

Authorization is capability and scope based.

The authoritative decision is:

```text
Actor
+
Permission
+
Scope
+
Resource
+
Domain Rules
```

A role may be used as a reusable permission bundle, but roles are not the final security decision.

## Actor Types

The platform recognizes conceptual actor types such as:

```text
USER
AI_AGENT
SYSTEM
INTEGRATION
```

Each actor must have an explicit security context.

## Permissions

Permissions should represent business capabilities.

Examples:

```text
orders.read
orders.accept
orders.reject
orders.update
orders.serve

tables.read
tables.update

payments.read
payments.create
payments.refund

menu.read
menu.update

staff.read
staff.manage

reports.read
```

This list is illustrative architecture guidance, not a permission inventory to invent beyond the product requirements.

## Scope

Permissions must be evaluated against scope.

Possible scope dimensions include:

```text
Organization
Restaurant
Branch
Resource
```

More granular resource/table scope may be required for certain staff assignments.

Example:

```text
Actor: Waiter
Permission: orders.accept
Scope: Branch #12
Resource scope: Tables 1, 2, 5
```

## Central Authorization Flow

```text
Request
  ↓
Authentication
  ↓
Identify Actor
  ↓
Determine Resource
  ↓
Check Permission
  ↓
Check Scope
  ↓
Check Resource Relationship
  ↓
Check Domain Rules
  ↓
Allow / Deny
```

## Backend Authority

The backend is the final security authority.

Frontend permission checks exist for UX only.

Never trust:

- Hidden buttons
- Client-side route guards
- Browser state
- UI role checks
- Client-supplied organization IDs
- Client-supplied branch access claims

The backend must derive and validate authorization context.

## Domain Rules

Permission alone may not be sufficient.

Examples:

- A waiter may have `orders.serve` but only for an assigned branch.
- A staff member may read a resource but not mutate it.
- A payment refund may require additional policy/confirmation.
- A table session may only transition to closed after payment conditions are satisfied.

## AI Authorization

AI follows exactly the same security principles.

```text
AI Agent
  ↓
Tool
  ↓
Authorization
  ↓
Application Service
  ↓
Domain
```

AI must never bypass the normal authorization path.

## Audit

Sensitive authorization decisions and mutations should be auditable.

Relevant audit information may include:

```text
actorType
actingUserId
aiAgentId
organizationId
restaurantId
branchId
permission
resource
action
authorizationResult
timestamp
```

The final audit schema is defined during implementation and database design.
