# apps/api — connecting to your existing local database

Your tables already exist (created via SQL/migration tool, no ORM yet).
The correct move is **introspection** — let Prisma read your real schema
and generate matching models, rather than hand-writing models and hoping
they match your actual columns.

## Setup

```bash
cd apps/api
pnpm install
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to your actual local Postgres
credentials:

```
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/YOUR_DB_NAME?schema=public
```

## Introspect your existing tables

```bash
pnpm prisma:pull
```

This reads your live database and writes real `model` blocks into
`prisma/schema.prisma` below the datasource/generator config — matching
your actual column names, types, and constraints exactly.

**Open `prisma/schema.prisma` afterward and check it makes sense** —
introspection sometimes needs small manual adjustments (relation names,
`@map` for snake_case columns if your SQL used `created_at` instead of
Prisma's usual `createdAt`, etc.). This is expected, not an error.

## Generate the Prisma client

```bash
pnpm prisma:generate
```

This is what turns your schema into actual TypeScript types/methods
(`prisma.order.findMany()`, etc.) — needed every time the schema changes,
including right after `prisma:pull`.

## Run it and confirm the connection

```bash
pnpm start:dev
```

Then in another terminal:

```bash
curl http://localhost:3000/health/db
```

You should get:
```json
{"status":"ok","db":"connected"}
```

If instead you get a 503 with a connection error, check:
- Is Postgres actually running locally? (`pg_isready` or check Docker)
- Does `DATABASE_URL` in `.env` have the right user/password/port/db name?
- Does the Postgres user have permission to connect to that database?

## What's deliberately not here yet

No domain modules (Orders, Kitchen, Payments, etc.), no auth module, no
role-based access control wiring. Per `RULES.md` #20 (vertical delivery)
and #24 (no invented scope), those get built as approved features, not
scaffolded empty ahead of time. This piece's only job was: prove
apps/api can actually talk to your real database.

## Next steps once this works

1. Review the introspected `schema.prisma` — does it match `HIERARCHY.md`'s
   expected entities (Organization → Restaurant → Branch → ...)? If your
   existing tables were built before that hierarchy was finalized, this is
   the point where mismatches surface.
2. Decide the auth strategy (JWT issued by NestJS + Passport, vs. an
   external identity provider) — needed before any real endpoint can
   enforce the Actor + Permission + Scope model from `AUTHORIZATION.md`.
3. Build the **first domain module** as a real vertical slice, not all
   domains scaffolded shallowly — matching the sequencing suggestion in
   `STATUS.md`.
