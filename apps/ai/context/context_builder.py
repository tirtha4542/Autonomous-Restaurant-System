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
    
    # 1. If actor is a customer seated at a specific table
    if table_code:
        session_id = scope.get("table_session_id", "active")
        return (
            f"You are speaking with a guest seated at Table {table_code} (Table Session #{session_id}). "
            f"Strictly focus on Table {table_code}. "
            f"Never show, disclose, or discuss orders from other tables (like Table 1 or Table 2)."
        )

    # 2. Kitchen Line Cook / Chef context
    if "items.write" in actor.permissions and "reports.read" not in actor.permissions:
        station = scope.get("station", "all stations")
        return (
            f"You are speaking with Kitchen Staff / Chef (Station: {station}). "
            "You are responsible for food preparation tickets, cooking stations, and the kitchen queue. "
            "You do NOT manage dining room tables, seating, or customer service."
        )

    # 3. Floor Waiter context
    if "orders.serve" in actor.permissions and "reports.read" not in actor.permissions:
        raw = await client.get_context_bootstrap(actor)
        tables = raw.get("assigned_tables", [])
        sessions = raw.get("active_sessions", [])
        return (
            f"You are speaking with a Floor Waiter. "
            f"Assigned floor tables: {tables}. Active dining sessions: {len(sessions)}. "
            "Focus on dining room table monitoring, guest ordering, and serving ready dishes."
        )

    # 4. Cashier context
    if "payments.write" in actor.permissions and "reports.read" not in actor.permissions:
        raw = await client.get_context_bootstrap(actor)
        tables = raw.get("assigned_tables", [])
        sessions = raw.get("active_sessions", [])
        return (
            f"You are speaking with the Branch Cashier (Station: Checkout / Counter). "
            f"Active dining table sessions: {len(sessions)}. Tables: {tables}. "
            "You assist with checking table bills, order subtotals, tax, payment statuses, receipt breakdowns, and bill settlements. "
            "You do NOT manage cooking in the kitchen or take orders on the floor."
        )

    # 5. Executive Manager context
    if "reports.read" in actor.permissions:
        raw = await client.get_context_bootstrap(actor)
        tables = raw.get("assigned_tables", [])
        sessions = raw.get("active_sessions", [])
        return (
            f"You are speaking with the General Manager. "
            f"Branch tables: {tables}. Active dining sessions: {len(sessions)}. "
            "Full operational oversight over branch KPIs, audit event logs, kitchen throughput, and floor occupancy."
        )

    # Default fallback
    raw = await client.get_context_bootstrap(actor)
    tables = raw.get("assigned_tables", [])
    sessions = raw.get("active_sessions", [])
    return f"Staff operational context. Tables: {tables}. Active sessions: {len(sessions)}."
