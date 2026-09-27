"""
AI.md "Context":
  Raw Domain Data/Events -> Context Builder -> Scope Resolver -> Safe Context -> AI
"""

from ..internal_client import InternalClient
from ..models import ActorContext


async def build_context(client: InternalClient, actor: ActorContext) -> str:
    """Returns a short natural-language summary for the system prompt —
    never raw rows, never more than this actor's scope needs."""
    scope = actor.resource_scope or {}
    table_code = scope.get("table_code")
    
    # If actor is a customer seated at a specific table
    if table_code:
        session_id = scope.get("table_session_id", "active")
        return (
            f"You are speaking with a guest seated at Table {table_code} (Table Session #{session_id}). "
            f"Strictly focus on Table {table_code}. "
            f"Never show, disclose, or discuss orders from other tables (like Table 1 or Table 2)."
        )

    # Staff / manager context
    raw = await client.get_context_bootstrap(actor)
    tables = raw.get("assigned_tables", [])
    sessions = raw.get("active_sessions", [])
    return f"Staff operational context. Assigned tables: {tables}. Active table sessions: {len(sessions)}."
