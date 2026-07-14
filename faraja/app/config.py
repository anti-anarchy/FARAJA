"""
config.py
─────────
Environment-driven settings for the Faraja AI service.

No model runs on this box — inference is hosted (primary + backup engines),
so the service only needs FastAPI. Brand names live here (backend plumbing)
and never surface to users.
"""

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ── Engine chain (failover order; backend only) ───────────────────────────
    LLM_PROVIDERS: list[str] = [
        p.strip().lower()
        for p in os.getenv("LLM_PROVIDERS", "gemini,groq").split(",")
        if p.strip()
    ]

    GEMINI_API_KEY:  str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL:    str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_BASE_URL: str = os.getenv(
        "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
    )

    GROQ_API_KEY:  str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL:    str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

    LLM_TIMEOUT: int = int(os.getenv("LLM_TIMEOUT", "60"))

    # ── App ───────────────────────────────────────────────────────────────────
    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", "8088"))
    APP_ENV:  str = os.getenv("APP_ENV", "development")
    # Comma-separated allowed origins, or "*" for all (dev default)
    CORS_ORIGINS: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
