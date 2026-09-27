"""
Tool registry — the approved tool inventory (AI.md: "the actual tool
inventory must be approved as features are implemented"). Start small
and read-only; add write tools + risk tiers only as product approves them.
"""

from ..models import ActorContext

TOOLS: dict[str, dict] = {
    "get_menu": {
        "required_permission": "menu.read",
        "risk_tier": "read_only",
        "schema": {
            "type": "function",
            "function": {
                "name": "get_menu",
                "description": "Get the current branch menu (items, prices, categories).",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        },
    },
    "get_table_status": {
        "required_permission": "tables.read",
        "risk_tier": "read_only",
        "schema": {
            "type": "function",
            "function": {
                "name": "get_table_status",
                "description": "Get the current status of a specific table.",
                "parameters": {
                    "type": "object",
                    "properties": {"table_id": {"type": "string"}},
                    "required": ["table_id"],
                },
            },
        },
    },
    "get_order_status": {
        "required_permission": "orders.read",
        "risk_tier": "read_only",
        "schema": {
            "type": "function",
            "function": {
                "name": "get_order_status",
                "description": "Get the current status of an order. For a table customer asking about their order, pass null or omit order_id to retrieve the active order for their specific table.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_id": {
                            "type": ["string", "null"],
                            "description": "Optional order ID number (e.g. '1', '2'), or null/omitted if checking the active order for the guest's current table.",
                        }
                    },
                    "required": [],
                },
            },
        },
    },
    "get_kitchen_queue": {
        "required_permission": "items.write",
        "risk_tier": "read_only",
        "schema": {
            "type": "function",
            "function": {
                "name": "get_kitchen_queue",
                "description": "Get current active orders and tickets in the kitchen preparation queue across all stations.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "station": {
                            "type": ["string", "null"],
                            "description": "Optional station filter ('grill', 'cold', 'fryer', 'coffee', 'bar') or null for all.",
                        }
                    },
                    "required": [],
                },
            },
        },
    },
    "get_branch_summary": {
        "required_permission": "reports.read",
        "risk_tier": "read_only",
        "schema": {
            "type": "function",
            "function": {
                "name": "get_branch_summary",
                "description": "Get executive operational summary for the branch: total tables, occupied tables, available tables, open orders count, and audit event volume.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        },
    },
    "get_audit_events": {
        "required_permission": "reports.read",
        "risk_tier": "read_only",
        "schema": {
            "type": "function",
            "function": {
                "name": "get_audit_events",
                "description": "Get the most recent system audit logs, state transitions, and actor actions for this restaurant branch.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        },
    },
}


def tools_for_actor(actor: ActorContext) -> list[dict]:
    """Dynamic tool pruning: only expose tools this actor's resolved
    permissions actually allow (AI.md 'Context' — never over-provide)."""
    return [t["schema"] for t in TOOLS.values() if t["required_permission"] in actor.permissions]


def get_tool(name: str) -> dict | None:
    return TOOLS.get(name)
