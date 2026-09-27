from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "dev"
    ai_service_name: str = "apps-ai"
    ai_agent_default_id: str = "waiter_ai_v1"

    # --- Internal platform boundary (apps/api) ---
    internal_api_base_url: str = "http://localhost:3000/internal"
    internal_api_service_token: str = ""

    # --- Model provider: Groq ---
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # --- Cache (not authoritative — ElastiCache Redis/Valkey per DEVOPS.md) ---
    redis_url: str = "redis://localhost:6379/0"

    log_level: str = "info"

    # Flip to False once the backend team has implemented the 5 contract
    # routes documented in internal_client.py / README.md. Until then,
    # apps/ai runs fully standalone against local fixtures.
    dev_mode_mock_backend: bool = True

    model_config = SettingsConfigDict(env_file=(Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent.parent / ".env", ".env"), extra="ignore")


settings = Settings()
