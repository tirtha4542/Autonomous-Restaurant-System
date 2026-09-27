# DevOps and AWS Architecture

## Deployment Direction

The initial platform should run primarily on managed AWS services.

Conceptual architecture:

```text
Internet
  ↓
Route 53
  ↓
CloudFront / WAF
  ↓
ALB
  ↓
ECS / Fargate
  ├── API
  ├── Realtime
  └── Worker
  ↓
RDS PostgreSQL
ElastiCache Redis/Valkey
SQS
S3
```

AI workloads may use a separate runtime while calling the same authorized application capabilities.

## Network

Initial VPC structure:

```text
VPC
├── Public Subnets
│   ├── ALB
│   └── NAT
├── Private App Subnets
│   ├── ECS
│   └── Workers
└── Private Data Subnets
    ├── RDS
    └── ElastiCache
```

Database and cache services must not be publicly reachable.

## Security Groups

Conceptually:

```text
Internet
  ↓
ALB
  ↓
ECS
  ↓
RDS
Redis
```

Only required traffic should be permitted between security groups.

## Compute

Use ECS/Fargate initially.

Do not introduce EKS solely for architectural fashion.

Potential future services can be extracted without changing the initial domain architecture.

## Database

Use RDS PostgreSQL with production-appropriate:

- Backups
- Point-in-time recovery
- Monitoring
- Multi-AZ where required by environment/SLA

Exact sizing and availability settings are environment-specific.

## Cache

Use ElastiCache Redis/Valkey for appropriate use cases such as:

- Cache
- Presence
- Rate limiting
- Realtime coordination
- Short-lived operational state

Redis/Valkey must not become the authoritative store for transactional business state.

## Queue / Events

Use SQS and/or EventBridge for asynchronous workflows where appropriate.

Do not introduce Kafka/Redpanda/NATS without a documented requirement.

## Storage

Use S3 for:

- Uploaded assets
- Documents
- Reports
- Generated files
- Other object storage requirements

## Secrets

Use AWS Secrets Manager and/or SSM Parameter Store.

Never commit production credentials.

Avoid long-lived AWS access keys where IAM roles can be used.

## Access

Prefer:

- IAM roles
- ECS task roles
- SSM/ECS Exec

Avoid routine SSH access to application servers.

## CI/CD

The intended direction is:

```text
GitHub
  ↓
CI
  ├── Lint
  ├── Typecheck
  ├── Test
  └── Security checks
  ↓
Docker build
  ↓
ECR
  ↓
ECS deployment
```

Terraform changes should have a separate review/apply workflow.

## Environments

Initial environments:

```text
dev
staging
production
```

Environment configuration and secrets must remain separated.

## Infrastructure as Code

Terraform structure:

```text
infra/
├── modules/
│   ├── vpc/
│   ├── ecs/
│   ├── alb/
│   ├── rds/
│   ├── redis/
│   ├── s3/
│   ├── sqs/
│   ├── iam/
│   ├── ecr/
│   ├── cloudfront/
│   ├── waf/
│   ├── secrets/
│   └── monitoring/
└── environments/
    ├── dev/
    ├── staging/
    └── production/
```

Remote Terraform state should use an appropriate managed backend and locking mechanism.

## Observability

Initial observability can use CloudWatch with structured application logs and metrics.

Important metrics include:

- API latency
- 4xx/5xx rate
- Database connections
- Database CPU
- Redis memory
- ECS CPU/memory
- SQS queue depth
- WebSocket connections
- Orders per minute
- Order acceptance latency
- Kitchen preparation time
- Payment failure rate

AI observability should include, where safe:

```text
agent
user
organization
scope
model
tool
latency
tokens
cost
result
```

Sensitive data must be redacted.

## Deployment Evolution

Start simple.

Potential future additions:

- Blue/green deployment
- Canary releases
- More advanced autoscaling
- Multi-region architecture
- Dedicated service deployments

These require explicit operational justification.
