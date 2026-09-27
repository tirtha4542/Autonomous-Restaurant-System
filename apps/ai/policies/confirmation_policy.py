"""
Handles the two-step handshake for high-risk tools (refund, large discount,
permission changes, destructive deletion — AI.md "Action Risk" examples).

Not yet wired into the executor because no high-risk tools are registered
yet (tools/registry.py). When one is added:
  1. tools/executor.py checks action_policy.requires_confirmation(risk_tier)
  2. if True, call internal_client.execute_tool as a "propose" call that
     returns {ok: false, pending_confirmation_id, data: {summary}}
     instead of executing
  3. surface that to the user via the agent's reply
  4. a second user confirmation triggers internal_client.confirm_tool(...)
"""

from typing import Any


def build_confirmation_prompt(tool_name: str, summary: dict[str, Any]) -> str:
    return f"This action ({tool_name}) needs your confirmation: {summary}. Reply 'confirm' to proceed."
