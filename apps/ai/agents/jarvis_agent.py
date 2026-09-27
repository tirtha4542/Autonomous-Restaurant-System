import asyncio
import json
from ..context.context_builder import build_context
from ..conversations.store import ConversationStore
from ..internal_client import InternalClient
from ..models import ActorContext
from ..providers.groq_provider import GroqProvider
from ..tools.executor import ToolExecutionError, ToolExecutor
from ..tools.registry import tools_for_actor

MAX_TOOL_ITERATIONS = 5

SYSTEM_PROMPT_TEMPLATE = """You are JARVIS, an AI assistant for restaurant staff and customers.
Acting as agent: {agent_id}
Branch: {branch_id}
You currently have access to read-only informational and advisory tools.
You do NOT have tools to perform operational actions (such as starting cooking, changing food preparation status, processing payments, or cancelling orders).
If a user asks you to execute an operational or kitchen action (e.g. 'Start cooking', 'Prepare item', 'Cancel order'), explicitly inform them that you do not have the tool or authorization to modify kitchen tickets/operations directly, and advise them to use the portal dashboard.
You may only use the tools made available to you in this conversation.
Never assume or fabricate data you were not given by a tool result.
Current operational context: {context_summary}
Be concise, helpful, and specific."""


class JarvisAgent:
    def __init__(self, internal_client: InternalClient, conversation_store: ConversationStore) -> None:
        self._client = internal_client
        self._store = conversation_store
        self._provider = GroqProvider()
        self._executor = ToolExecutor(internal_client)

    async def handle_message(self, actor: ActorContext, session_id: str, message: str) -> str:
        history = self._store.get(session_id)
        context_summary = await build_context(self._client, actor)
        tools = tools_for_actor(actor)

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            agent_id=actor.ai_agent_id or "jarvis",
            branch_id=actor.branch_id,
            context_summary=context_summary,
        )

        messages: list[dict] = (
            [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]
        )

        for _ in range(MAX_TOOL_ITERATIONS):
            try:
                response = await self._provider.generate(messages=messages, tools=tools)
            except Exception as exc:
                fallback = f"I encountered an issue processing that: {str(exc)}"
                return fallback

            if not response.get("tool_calls"):
                final_reply = response.get("content") or "I don't have an answer for that right now."
                self._store.append(session_id, {"role": "user", "content": message})
                self._store.append(session_id, {"role": "assistant", "content": final_reply})
                return final_reply

            formatted_tool_calls = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": json.dumps(tc["arguments"]) if isinstance(tc["arguments"], dict) else str(tc["arguments"]),
                    },
                }
                for tc in response["tool_calls"]
            ]

            messages.append(
                {
                    "role": "assistant",
                    "content": response.get("content") or "",
                    "tool_calls": formatted_tool_calls,
                }
            )

            for call in response["tool_calls"]:
                tool_name = call["name"]
                args = {k: v for k, v in (call.get("arguments") or {}).items() if v is not None}
                try:
                    tool_output = await self._executor.execute(tool_name, args, actor)
                except ToolExecutionError as exc:
                    tool_output = {"ok": False, "error": str(exc)}

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(tool_output) if isinstance(tool_output, dict) else str(tool_output),
                    }
                )

        fallback = "I wasn't able to complete that - please rephrase or ask a staff member for help."
        self._store.append(session_id, {"role": "user", "content": message})
        self._store.append(session_id, {"role": "assistant", "content": fallback})
        return fallback

    async def stream_message(self, actor: ActorContext, session_id: str, message: str):
        """Streams tokens in SSE format: data: {"type": "chunk", "content": "..."}\n\n"""
        history = self._store.get(session_id)
        context_summary = await build_context(self._client, actor)
        tools = tools_for_actor(actor)

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            agent_id=actor.ai_agent_id or "jarvis",
            branch_id=actor.branch_id,
            context_summary=context_summary,
        )

        messages: list[dict] = (
            [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]
        )

        for _ in range(MAX_TOOL_ITERATIONS):
            try:
                response = await self._provider.generate(messages=messages, tools=tools)
            except Exception as exc:
                err_msg = f"I encountered an error querying the model ({type(exc).__name__}): {str(exc)}"
                yield f"data: {json.dumps({'type': 'chunk', 'content': err_msg})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'reply': err_msg})}\n\n"
                return

            if not response.get("tool_calls"):
                content = response.get("content") or "I don't have an answer for that right now."
                
                # Stream the final generated response word-by-word with realistic typing pace
                words = content.split(" ")
                for i, w in enumerate(words):
                    piece = w if i == len(words) - 1 else w + " "
                    yield f"data: {json.dumps({'type': 'chunk', 'content': piece})}\n\n"
                    await asyncio.sleep(0.015)

                self._store.append(session_id, {"role": "user", "content": message})
                self._store.append(session_id, {"role": "assistant", "content": content})
                yield f"data: {json.dumps({'type': 'done', 'reply': content})}\n\n"
                return

            formatted_tool_calls = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": json.dumps(tc["arguments"]) if isinstance(tc["arguments"], dict) else str(tc["arguments"]),
                    },
                }
                for tc in response["tool_calls"]
            ]

            messages.append(
                {
                    "role": "assistant",
                    "content": response.get("content") or "",
                    "tool_calls": formatted_tool_calls,
                }
            )

            for call in response["tool_calls"]:
                tool_name = call["name"]
                yield f"data: {json.dumps({'type': 'status', 'status': f'Executing {tool_name}...' })}\n\n"
                args = {k: v for k, v in (call.get("arguments") or {}).items() if v is not None}
                try:
                    tool_output = await self._executor.execute(tool_name, args, actor)
                except ToolExecutionError as exc:
                    tool_output = {"ok": False, "error": str(exc)}

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(tool_output) if isinstance(tool_output, dict) else str(tool_output),
                    }
                )

        fallback = "I wasn't able to complete that - please rephrase or ask a staff member for help."
        self._store.append(session_id, {"role": "user", "content": message})
        self._store.append(session_id, {"role": "assistant", "content": fallback})
        yield f"data: {json.dumps({'type': 'chunk', 'content': fallback})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'reply': fallback})}\n\n"
