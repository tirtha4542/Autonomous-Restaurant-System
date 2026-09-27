# AI Architecture

## Principle

AI is another authorized client of the platform.

It is not a privileged subsystem.

The core rule is:

```text
AI
 ↓
Agent Runtime
 ↓
Tool Gateway
 ↓
Authorization
 ↓
Application / Domain Service
 ↓
Database
```

Never:

```text
AI → SQL → Database
```

## Actor Model

AI agents should have an explicit actor identity.

Conceptual actor types:

```text
USER
AI_AGENT
SYSTEM
INTEGRATION
```

An AI action may operate on behalf of a human user while retaining its own agent identity.

## Scope

Every AI interaction should have enough context to determine:

- Acting user
- AI agent
- Organization
- Restaurant
- Branch
- Resource scope
- Allowed permissions

Example:

```text
AI Agent
  ↓
Acting for Waiter
  ↓
Branch #12
  ↓
Assigned Tables
  ↓
orders.read
orders.serve
tables.read
```

The agent must not infer or expand its own scope.

## Tool Gateway

Tools are explicit application capabilities.

Example read tools:

```text
get_table_status
get_order
get_order_queue
get_order_timeline
```

Example mutation tools:

```text
accept_order
reject_order
serve_order
complete_order_item
```

The actual tool inventory must be approved as features are implemented.

## Tool Execution

Every tool call must pass through authorization.

```text
AI Tool Call
  ↓
Resolve Actor
  ↓
Resolve Scope
  ↓
Check Permission
  ↓
Validate Resource
  ↓
Validate Domain State
  ↓
Execute Application Command
  ↓
Audit
```

AI must not call repositories directly.

## Context

AI context should be current, scoped, and minimal.

```text
Raw Domain Data / Events
        ↓
Context Builder
        ↓
Scope Resolver
        ↓
Safe Context
        ↓
AI
```

Do not provide an AI agent with an entire organization's data when it only needs one branch or table.

## Action Risk

Tools should have risk policies.

Conceptually:

### Read-only

May execute automatically when authorized.

### Low-risk mutation

May execute automatically when authorized and domain rules permit.

### High-risk mutation

May require explicit confirmation or stronger policy.

Examples:

- Refund
- Large discount
- Permission changes
- Destructive deletion

Exact risk classifications should be documented before implementation.

## AI Audit

AI actions should record enough information for investigation:

```text
actorType
actingUserId
aiAgentId
organizationId
branchId
action
resource
before
after
authorizationResult
timestamp
source
```

AI responses and tool calls should be traceable without unnecessarily storing sensitive content.

## AI Structure

The conceptual AI subsystem is:

```text
ai/
├── agents/
├── context/
│   ├── context-builder/
│   ├── scope-resolver/
│   └── context-providers/
├── tools/
│   ├── registry/
│   ├── definitions/
│   ├── executor/
│   └── authorization/
├── conversations/
├── policies/
│   ├── action-policy/
│   └── confirmation-policy/
├── providers/
└── audit/
```

## Provider Abstraction

Model providers must be isolated behind a provider boundary.

The initial provider may be AWS Bedrock or another approved provider.

Business domains must not depend directly on a model vendor SDK.

## AI and Realtime

AI may consume domain events or current state through authorized application interfaces.

AI-generated actions must use normal domain commands.

Example:

```text
Voice: "Table 5 burger completed"
  ↓
Intent extraction
  ↓
complete_order_item tool
  ↓
Authorization
  ↓
Order/Kitchen application service
  ↓
Domain validation
  ↓
State change
  ↓
Realtime event
  ↓
Waiter UI
```

**NOTE**: AI code will be written in python languages.
