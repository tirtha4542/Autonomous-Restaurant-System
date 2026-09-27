"""
apps/ai entrypoint.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .agents.jarvis_agent import JarvisAgent
from .conversations.store import ConversationStore
from .internal_client import InternalClient
from .models import ActorContext, ChatRequest, ChatResponse

internal_client = InternalClient()
conversation_store = ConversationStore()
agent = JarvisAgent(internal_client=internal_client, conversation_store=conversation_store)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await internal_client.aclose()


app = FastAPI(title="apps-ai — JARVIS agent runtime", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_effective_session_id(actor: ActorContext, session_id: str) -> str:
    """Strictly isolates conversation memory per table and per staff user so no table ever sees another table's chat."""
    scope = actor.resource_scope or {}
    table_code = scope.get("table_code")
    if table_code:
        table_session_id = scope.get("table_session_id") or "active"
        return f"customer_table_{table_code}_{table_session_id}_{session_id}"
    
    # Staff / employee sessions
    acting_user = actor.acting_user_id or actor.actor_type
    return f"staff_{acting_user}_{session_id}"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ai/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    actor = await internal_client.resolve_actor(token)
    if actor is None:
        raise HTTPException(status_code=401, detail="Could not resolve actor from token")

    effective_session_id = _resolve_effective_session_id(actor, payload.session_id)
    reply = await agent.handle_message(actor=actor, session_id=effective_session_id, message=payload.message)
    return ChatResponse(session_id=payload.session_id, reply=reply)


@app.post("/ai/chat/stream")
async def chat_stream(payload: ChatRequest, authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    actor = await internal_client.resolve_actor(token)
    if actor is None:
        raise HTTPException(status_code=401, detail="Could not resolve actor from token")

    effective_session_id = _resolve_effective_session_id(actor, payload.session_id)
    return StreamingResponse(
        agent.stream_message(actor=actor, session_id=effective_session_id, message=payload.message),
        media_type="text/event-stream",
    )
