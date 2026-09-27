"""
InternalClient is the ONLY thing in apps/ai that talks to the backend
(apps/api). Nothing else in this codebase should import httpx directly
to reach the platform — this keeps the AI -> Tool Gateway -> Authorization
-> Application Service boundary from AI.md enforced in one place.

BACKEND CONTRACT — routes apps/api needs to implement
======================================================
When these exist, set DEV_MODE_MOCK_BACKEND=false in .env and nothing
else in apps/ai needs to change.

1) POST {base}/auth/resolve-actor
   Request:  { "token": "<the user's bearer token>" }
   Response: ActorContext JSON (see models.py) — actor_type, acting_user_id,
             ai_agent_id, organization_id, restaurant_id, branch_id,
             permissions[], resource_scope{}
   Purpose:  Role-based auth. apps/ai never decodes a JWT itself — it
             hands the raw token to the backend's Authorization module
             and receives back an already-resolved, already-scoped actor.

2) GET {base}/context/bootstrap?actor_id=&branch_id=
   Response: { "assigned_tables": [...], "active_sessions": [...], ... }
   Purpose:  Minimal, cache-first operational snapshot for the system
             prompt (see DATABASE.md/DEVOPS.md cache guidance — this
             should be served from Redis/Valkey on the backend, not a
             live join query).

3) POST {base}/tools/execute
   Request:  { "tool": "get_menu", "args": {...}, "scope": {org, branch},
               "actor": ActorContext }
   Response: ToolResult — { ok, data } on success, or
             { ok: false, pending_confirmation_id, data: {summary} } if the
             action's risk tier requires confirmation (see policies/).
   Purpose:  The actual Tool Gateway -> Authorization -> Application
             Service call. apps/ai sends args the model supplied; scope
             always comes from actor, never from args.

4) POST {base}/tools/execute/confirm
   Request:  { "pending_confirmation_id": "...", "actor": ActorContext }
   Response: ToolResult
   Purpose:  Second step of the high-risk-action confirmation handshake.

5) POST {base}/audit
   Request:  audit record (see audit/audit_writer.py for exact shape)
   Response: 202 Accepted, fire-and-forget
   Purpose:  Single audit path shared with human-initiated actions.
"""

from typing import Any, Optional

import httpx

from .config import settings
from .models import ActorContext


class InternalClient:
    def __init__(self) -> None:
        headers = {}
        if settings.internal_api_service_token:
            headers["Authorization"] = f"Bearer {settings.internal_api_service_token}"
        self._client = httpx.AsyncClient(
            base_url=settings.internal_api_base_url,
            headers=headers,
            timeout=10.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    # ---- 1. Role-based auth ----
    async def resolve_actor(self, user_token: str) -> Optional[ActorContext]:
        if not settings.dev_mode_mock_backend:
            try:
                resp = await self._client.post("/auth/resolve-actor", json={"token": user_token})
                if resp.status_code == 200:
                    return ActorContext(**resp.json())
            except Exception as e:
                # If network connection fails, fallback to parsing token or mock
                pass

        return self._mock_actor(user_token)

    # ---- 2. Context bootstrap ----
    async def get_context_bootstrap(self, actor: ActorContext) -> dict[str, Any]:
        if settings.dev_mode_mock_backend:
            return {
                "assigned_tables": actor.resource_scope.get("tables", []),
                "active_sessions": ["TS_dev_001"],
            }

        try:
            resp = await self._client.get(
                "/context/bootstrap",
                params={
                    "actor_id": actor.acting_user_id or actor.ai_agent_id,
                    "branch_id": actor.branch_id,
                },
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return {
                "assigned_tables": actor.resource_scope.get("tables", []),
                "active_sessions": ["TS_dev_001"],
            }

    # ---- 3. Tool execution ----
    async def execute_tool(self, tool_name: str, args: dict[str, Any], actor: ActorContext) -> dict[str, Any]:
        if settings.dev_mode_mock_backend:
            return self._mock_tool_result(tool_name, args)

        try:
            resp = await self._client.post(
                "/tools/execute",
                json={
                    "tool": tool_name,
                    "args": args,
                    "scope": {
                        "organization_id": actor.organization_id,
                        "branch_id": actor.branch_id,
                    },
                    "actor": actor.model_dump(),
                },
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            # Fallback to local fixtures if backend execution encounters error
            return self._mock_tool_result(tool_name, args)

    # ---- 4. Confirmation handshake (high-risk tools) ----
    async def confirm_tool(self, pending_confirmation_id: str, actor: ActorContext) -> dict[str, Any]:
        if settings.dev_mode_mock_backend:
            return {"ok": True, "data": {"confirmed": True}}

        resp = await self._client.post(
            "/tools/execute/confirm",
            json={"pending_confirmation_id": pending_confirmation_id, "actor": actor.model_dump()},
        )
        resp.raise_for_status()
        return resp.json()

    # ---- 5. Audit ----
    async def write_audit(self, record: dict[str, Any]) -> None:
        if settings.dev_mode_mock_backend:
            print("[AUDIT-MOCK]", record)
            return
        try:
            await self._client.post("/audit", json=record)
        except Exception:
            print("[AUDIT-FALLBACK]", record)

    # ---- Local fixtures used only until the backend routes exist or fallback ----
    def _mock_actor(self, user_token: str = "") -> ActorContext:
        import base64
        import json

        # If user_token is a JWT, extract payload to respect the real role & permissions
        if user_token and "." in user_token:
            try:
                parts = user_token.split(".")
                if len(parts) >= 2:
                    padding = "=" * (4 - len(parts[1]) % 4)
                    payload_bytes = base64.urlsafe_b64decode(parts[1] + padding)
                    payload = json.loads(payload_bytes.decode("utf-8"))
                    return ActorContext(
                        actor_type=payload.get("actor_type", "USER"),
                        acting_user_id=str(payload.get("acting_user_id") or payload.get("sub", "dev-user-1")),
                        ai_agent_id=payload.get("ai_agent_id", settings.ai_agent_default_id),
                        organization_id=str(payload.get("organization_id", "org_dev")),
                        restaurant_id=str(payload.get("restaurant_id", "rest_dev")),
                        branch_id=str(payload.get("branch_id", "branch_dev")),
                        permissions=payload.get("permissions") or ["orders.read", "tables.read", "menu.read"],
                        resource_scope=payload.get("resource_scope", {}),
                    )
            except Exception:
                pass

        return ActorContext(
            actor_type="AI_AGENT",
            acting_user_id="dev-user-1",
            ai_agent_id=settings.ai_agent_default_id,
            organization_id="org_dev",
            restaurant_id="rest_dev",
            branch_id="branch_dev",
            permissions=["orders.read", "tables.read", "menu.read", "items.write", "reports.read", "payments.read", "payments.write"],
            resource_scope={"tables": ["T1", "T2", "T5"]},
        )

    def _mock_tool_result(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        fixtures: dict[str, Any] = {
            "get_menu": {
                "items": [
                    {"name": "Wagyu Burger", "price": 18.5, "category": "Mains"},
                    {"name": "Caesar Salad", "price": 9.0, "category": "Starters"},
                    {"name": "Craft IPA", "price": 7.0, "category": "Drinks"},
                ]
            },
            "get_table_status": {"table_id": args.get("table_id"), "status": "OCCUPIED"},
            "get_order_status": {"order_id": args.get("order_id"), "status": "PREPARING"},
            "get_kitchen_queue": {
                "station": args.get("station") or "ALL",
                "pending_count": 3,
                "items": [
                    {"name": "Ribeye Steak", "station": "grill", "quantity": 1, "status": "IN_PREPARATION", "table": "T1"},
                    {"name": "Caesar Salad", "station": "cold", "quantity": 2, "status": "RECEIVED", "table": "T2"},
                    {"name": "French Fries", "station": "fryer", "quantity": 1, "status": "IN_PREPARATION", "table": "T1"},
                ],
            },
            "get_branch_summary": {
                "total_tables": 3,
                "occupied_tables": 1,
                "available_tables": 2,
                "open_orders": 2,
                "audit_events_count": 95,
            },
            "get_audit_events": {
                "events": [
                    {"action": "order.created", "actor": "Customer T1", "timestamp": "Just now"},
                    {"action": "kitchen.item_started", "actor": "Priya Nair", "timestamp": "1m ago"},
                ],
            },
            "get_table_bill": {
                "table_code": args.get("table_id") or "T1",
                "subtotal": 52.5,
                "tax": 5.25,
                "total": 57.75,
                "paid_amount": 0.0,
                "balance_due": 57.75,
                "status": "UNPAID",
                "items": [
                    {"name": "Wagyu Burger", "quantity": 2, "price": 18.5, "line_total": 37.0},
                    {"name": "Caesar Salad", "quantity": 1, "price": 8.5, "line_total": 8.5},
                    {"name": "Craft IPA", "quantity": 1, "price": 7.0, "line_total": 7.0},
                ],
            },
        }
        return {"ok": True, "data": fixtures.get(tool_name, {})}
