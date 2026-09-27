from abc import ABC, abstractmethod
from typing import Any, Optional, TypedDict


class ToolCall(TypedDict):
    id: str
    name: str
    arguments: dict[str, Any]


class ProviderResponse(TypedDict):
    role: str
    content: Optional[str]
    tool_calls: Optional[list[ToolCall]]


class ModelProvider(ABC):
    """Vendor SDKs must stay behind this interface (AI.md 'Provider
    Abstraction') — no other module should import a model vendor SDK."""

    @abstractmethod
    async def generate(self, messages: list[dict], tools: list[dict]) -> ProviderResponse:
        ...
