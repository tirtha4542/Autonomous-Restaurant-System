# Business Hierarchy

## Platform Hierarchy

```text
Platform Owner
└── Organization
    └── Restaurant
        └── Branch
            ├── Floor
            ├── Table
            ├── Staff Assignment
            ├── Menu
            ├── Customer Session
            ├── Table Session
            ├── Order
            ├── Kitchen
            └── Payment
```

## Platform Owner

The platform owner operates the SaaS platform itself.

Platform-level responsibilities may include:

- Organization provisioning
- Platform configuration
- Subscription/platform management
- Global administration
- Platform-level reporting
- System operations

Platform ownership is above tenant organization data.

## Organization

An organization is a tenant/customer of the SaaS platform.

An organization may own or manage one or more restaurants.

Tenant isolation is mandatory.

## Restaurant

A restaurant belongs to an organization.

A restaurant represents a logical restaurant business within the tenant.

## Branch

A branch is an operational physical location.

Branch-scoped operational resources include:

- Floors
- Tables
- Staff assignments
- Menus
- Customer sessions
- Table sessions
- Orders
- Kitchen operations
- Payments

## Floor

A floor groups tables within a branch.

## Table

A table is an operational customer seating resource.

A table should have a stable internal identity and an opaque QR token.

QR URLs must not expose sensitive internal identifiers.

## Staff

Staff are users/actors assigned to an organization, restaurant, and/or branch with explicit permissions and scopes.

A staff member may have different capabilities in different branches.

## Customer Session

A customer session represents the customer's browser/session identity for the ordering experience.

It is intentionally lightweight and must not require unnecessary account friction.

## Table Session

A table session represents a customer visit/order session at a specific table.

A table session is first-class because a customer may submit multiple orders during the same visit.

```text
Table Session
├── Order 1
├── Order 2
├── Order 3
└── Payment
```

## Order

An order belongs to a table session.

Orders contain order items and progress through controlled state transitions.

## Kitchen

Kitchen is an operational domain responsible for preparation workflow.

An accepted order can produce one or more kitchen tickets/station workloads.

## Payment

Payment is a separate sensitive domain.

Payment may support:

- Cash
- Card
- Digital providers

Provider-specific details must remain behind payment interfaces/adapters.

## Important Separation

Business hierarchy does not determine authorization by itself.

For example:

```text
Branch #12
  ↓
Staff assignment
  ↓
Permissions
  ↓
Resource scope
```

The hierarchy provides context. Authorization decides whether an actor can perform an action.
