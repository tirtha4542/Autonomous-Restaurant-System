# apps/ai — JARVIS Agent Runtime

Implements `AI.md`'s architecture: `AI -> Agent Runtime -> Tool Gateway ->
Authorization -> Application Service -> Database`. This service never
connects to PostgreSQL directly and never makes an authorization decision
of its own — it enforces what the backend has already resolved.

## Run it standalone (backend not ready yet)

```bash
cd apps/ai
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# add your real GROQ_API_KEY to .env
uvicorn main:app --reload --port 8001
```

With `DEV_MODE_MOCK_BACKEND=true` (the default), every backend call is
served from local fixtures in `internal_client.py` — you can test the
full "Ask JARVIS" loop today, including tool calls, with zero backend
code written yet.

Try it:

```bash
curl -X POST http://localhost:8001/ai/chat \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess_1", "message": "what is the menu?"}'
```

## Wiring your "Ask JARVIS" UI button

```
POST /ai/chat
Header: Authorization: Bearer <the user's normal session/JWT token>
Body:   { "session_id": "<any stable id per chat widget open>", "message": "<user's text>" }
Response: { "session_id": "...", "reply": "..." }
```

Role-based auth is automatic: whatever token the UI already attaches to
normal API calls is the same token to send here. This service hands it
to the backend's `/auth/resolve-actor` route (once it exists) and gets
back the user's real permissions — a customer, a waiter, and a manager
asking the same question get different tool access and different answers,
with zero special-casing in this codebase.

## Backend contract — 5 routes for apps/api to implement

Once these exist, set `DEV_MODE_MOCK_BACKEND=false` and nothing else in
`apps/ai` changes. Full request/response shapes are documented as a
docstring at the top of `internal_client.py`. Summary:

| Route | Purpose |
|---|---|
| `POST /internal/auth/resolve-actor` | Bearer token → `ActorContext` (role-based auth) |
| `GET /internal/context/bootstrap` | Minimal cache-first operational snapshot |
| `POST /internal/tools/execute` | The actual Tool Gateway → Authorization → Application Service call |
| `POST /internal/tools/execute/confirm` | Confirms a high-risk action (not yet used — no high-risk tools registered) |
| `POST /internal/audit` | Same audit path as human-initiated actions |

## What's registered today

Three read-only tools in `tools/registry.py`: `get_menu`, `get_table_status`,
`get_order_status`. Add more only once product/architecture approves them
(`AI.md`: "the actual tool inventory must be approved as features are
implemented") — don't invent scope (`RULES.md` #24).

## Known simplifications, flagged for follow-up

- **Conversation store is in-memory** (`conversations/store.py`). Fine for
  one process; swap for Redis before running more than one instance.
- **Context building is one file**, not the three folders
  (`context-builder/scope-resolver/context-providers/`) in `AI.md`'s
  conceptual tree — Python can't import hyphenated package names, and the
  split isn't justified yet at this size. Revisit if context sourcing
  grows more complex.
- **No streaming yet** — replies are single JSON responses. Add
  SSE/WebSocket once the UI needs incremental tokens.
- **Agent-orchestration framework**: this uses a small hand-rolled capped
  loop, not LangGraph or similar. That's a deliberate choice to avoid
  adding a dependency without an ADR (`RULES.md` #21, #23) — revisit if
  the tool-call graph gets more complex than linear chaining.
- **Model provider**: Groq, per your decision. `providers/base.py` keeps
  it swappable behind an interface if that changes later.
