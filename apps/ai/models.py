from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ActorContext(BaseModel):
    """
    Resolved once per request by the backend's Authorization module
    (see AUTHORIZATION.md, AI.md "Actor Model"). apps/ai never invents
    or expands this — it only enforces what's already inside it.
    """

    actor_type: Literal["USER", "AI_AGENT", "SYSTEM", "INTEGRATION"]
    acting_user_id: Optional[str] = None
    ai_agent_id: Optional[str] = None
    organization_id: str
    restaurant_id: Optional[str] = None
    branch_id: str
    permissions: list[str] = Field(default_factory=list)
    resource_scope: dict[str, Any] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class ToolResult(BaseModel):
    ok: bool
    data: Optional[dict[str, Any]] = None
    pending_confirmation_id: Optional[str] = None
    error: Optional[str] = None
