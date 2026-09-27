"""
In-memory conversation history keyed by session_id. Fine for local dev;
swap for Redis (already in requirements.txt, per DEVOPS.md's cache/
short-lived-state guidance) before running more than one process, since
in-memory state won't survive a restart or be shared across instances.
"""


class ConversationStore:
    def __init__(self) -> None:
        self._sessions: dict[str, list[dict]] = {}

    def get(self, session_id: str) -> list[dict]:
        return list(self._sessions.get(session_id, []))

    def append(self, session_id: str, message: dict) -> None:
        self._sessions.setdefault(session_id, []).append(message)
        # bound token growth — keep last 20 turns
        self._sessions[session_id] = self._sessions[session_id][-20:]
