from datetime import datetime, timezone
from typing import Any

from ..internal_client import InternalClient
from ..models import ActorContext


async def write_tool_audit(
    client: InternalClient,
    actor: ActorContext,
    tool_name: str,
    args: dict[str, Any],
    result: dict[str, Any],
) -> None:
    """Matches the shared audit shape from AI.md / DATABASE.md / AUTHORIZATION.md.
    This is the SAME audit path humans go through — no AI-specific schema."""
    record = {
        "actorType": actor.actor_type,
        "actingUserId": actor.acting_user_id,
        "aiAgentId": actor.ai_agent_id,
        "organizationId": actor.organization_id,
        "branchId": actor.branch_id,
        "action": tool_name,
        "resource": args,
        "before": None,
        "after": result.get("data"),
        "authorizationResult": "ALLOW" if result.get("ok", True) else "DENY",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "apps-ai",
    }
    await client.write_audit(record)
