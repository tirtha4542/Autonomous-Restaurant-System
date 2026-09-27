import json
from groq import AsyncGroq
from ..config import settings
from .base import ModelProvider, ProviderResponse, ToolCall

class GroqProvider(ModelProvider):
    def __init__(self) -> None:
        self._client = AsyncGroq(api_key=settings.groq_api_key)
        self._model = settings.groq_model

    async def generate(self, messages: list[dict], tools: list[dict]) -> ProviderResponse:
        kwargs = {}
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        resp = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            **kwargs,
        )
        choice = resp.choices[0].message

        tool_calls: list[ToolCall] | None = None
        if getattr(choice, "tool_calls", None):
            tool_calls = [
                {
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": json.loads(tc.function.arguments or "{}"),
                }
                for tc in choice.tool_calls
            ]

        return {"role": "assistant", "content": choice.content, "tool_calls": tool_calls}

    async def stream_generate(self, messages: list[dict]):
        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content or ""
            if content:
                yield content
