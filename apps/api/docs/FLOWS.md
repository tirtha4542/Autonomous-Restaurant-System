# Operational Flows

## Customer Flow

```text
Scan QR
  ↓
Resolve Table
  ↓
Start / Join Customer Session
  ↓
Start / Join Table Session
  ↓
Browse Menu
  ↓
Select Items
  ↓
Cart
  ↓
Before submit create account
-
Submit Order
  ↓
Wait for Waiter
  ├── Rejected
  └── Accepted
        ↓
     Kitchen
        ↓
     Preparing
        ↓
       Ready
        ↓
      Served
        ↓
   Request Bill
        ↓
     Payment
        ↓
Table Session Closed
```

## Waiter Flow

```text
Login
  ↓
Determine assigned branch/resources -> like tables
  ↓
View incoming customer orders
  ↓
Inspect order
  ├── Reject
  └── Accept
        ↓
      Kitchen
        ↓
Monitor preparation
        ↓
Receive ready notification
        ↓
Serve
        ↓
Handle bill/payment request
        ↓
Confirm/observe session closure
```

## Kitchen Flow

```text
Login
  ↓
Kitchen context
  ↓
View active queue
  ↓
Open ticket
  ↓
Start preparation
  ↓
Update item/ticket state
  ↓
Mark ready
  ↓
Notify waiter/customer
```

Kitchen should be modeled as a domain rather than as a collection of order UI screens.

## Cashier Flow

```text
Login
  ↓
View active sessions
  ↓
Review bill
  ↓
Apply permitted adjustment
  ↓
Select payment method
  ↓
Process / confirm payment
  ↓
Receipt
  ↓
Close session when valid
```

## Manager / Administrator Flow

```text
Organization
  ↓
Restaurant
  ↓
Branch
  ├── Floors / Tables
  ├── Menu
  ├── Staff
  ├── Permissions
  ├── Configuration
  └── Reports
```

Actual available actions depend on authorization.

## Order Lifecycle

```text
DRAFT
  ↓
SUBMITTED
  ├── REJECTED
  └── ACCEPTED
        ↓
    KITCHEN_QUEUE
        ↓
    PREPARING
        ↓
      READY
        ↓
      SERVED
```

State transitions must be controlled by domain rules.

## Table Session Lifecycle

A table session begins when a valid customer interaction creates or joins an active table session.

It can contain multiple orders.

It should close only when the required payment/session rules are satisfied.

## Payment Flow

```text
Payment Request
  ↓
Authorization
  ↓
Payment Provider / Cash Handling
  ↓
Payment Result
  ↓
Persist Payment State
  ↓
Emit Payment Event
  ↓
Update Session State
```

Payment provider integration must be isolated behind adapters.

## Realtime Flow

```text
Command
  ↓
API
  ↓
Domain State Change
  ↓
Event / Outbox
  ↓
Realtime Publisher
  ↓
Subscribed Clients
```

Realtime messages communicate state changes; they do not replace authoritative domain state.

## Feature Development Flow

Every major feature should be implemented as a vertical slice:

```text
Feature
  ↓
Define user flow
  ↓
Define authorization
  ↓
Define contract
  ↓
Backend + Frontend + Realtime
  ↓
Tests
  ↓
Deploy
  ↓
Monitor
```

Example:

```text
Customer submits order
  ↓
API command
  ↓
Validation + authorization
  ↓
Order state change
  ↓
OrderSubmitted event
  ↓
Waiter realtime update
  ↓
Audit
  ↓
Observability
```
