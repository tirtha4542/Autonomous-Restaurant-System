"""
ToolExecutor is the single most important module in apps/ai.

It implements AI.md's "Tool Execution" chain:
  Resolve Actor -> Resolve Scope -> Check Permission -> Validate Resource
  -> Validate Domain State -> Execute Application Command -> Audit

apps/ai does NOT re-decide authorization here — that decision was already
made by the backend when it resolved the ActorContext. What this module
enforces is narrower but non-negotiable: the model can only invoke a tool
whose required_permission is present in the already-resolved actor, and
it can NEVER supply its own scope (org_id/branch_id) — that always comes
from actor, regardless of what the LLM puts in tool arguments.
"""

from typing import Any

from ..audit.audit_writer import write_tool_audit
from ..internal_client import InternalClient
from ..models import ActorContext
from .registry import get_tool


class ToolExecutionError(Exception):
    pass


class ToolExecutor:
    def __init__(self, internal_client: InternalClient) -> None:
        self._client = internal_client

    async def execute(self, tool_name: str, args: dict[str, Any], actor: ActorContext) -> dict[str, Any]:
        tool = get_tool(tool_name)
        if tool is None:
            raise ToolExecutionError(f"Unknown tool: {tool_name}")

        if tool["required_permission"] not in actor.permissions:
            raise ToolExecutionError(
                f"Actor '{actor.ai_agent_id or actor.acting_user_id}' lacks permission "
                f"'{tool['required_permission']}' required for tool '{tool_name}'"
            )

        # args are whatever business parameters the model supplied
        # (e.g. table_id, order_id) — never org_id/branch_id/scope fields.
        # Those are injected server-side via `actor` inside internal_client.
        safe_args = {k: v for k, v in args.items() if k not in {"organization_id", "branch_id", "scope"}}

        result = await self._client.execute_tool(tool_name, safe_args, actor)

        await write_tool_audit(
            client=self._client,
            actor=actor,
            tool_name=tool_name,
            args=safe_args,
            result=result,
        )

        return result
