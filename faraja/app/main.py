"""
main.py
───────
Faraja AI service — the single hosted-AI brain for the crisis-mapping stack.

  uvicorn app.main:app --port 8088
  → http://localhost:8088/docs

Endpoints (matching what the apps already call):
  GET  /health              engine health by role (no vendor names)
  POST /copilot             dashboard/responder co-pilot  → {lines, actions, meta}
  POST /reporters/chat      reporters-app ChatBot          → {reply}

No model runs here — inference is hosted (primary + backup engines). Users only
ever see "Faraja".
"""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import copilot, llm, reporters
from app.config import settings


# ── Schemas ───────────────────────────────────────────────────────────────────

class CopilotRequest(BaseModel):
    query:       str = ""
    intent_hint: str = "freeform"
    history:     list[dict] = Field(default_factory=list)
    context:     dict = Field(default_factory=dict)


class ChatMessage(BaseModel):
    role:    str
    content: str


class ReportersChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await llm.close()


app = FastAPI(
    title="Faraja AI Service",
    description="The AI brain for the crisis-mapping stack: reporter assistant + "
                "responder/dashboard co-pilot. Hosted engines, no local models.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    engine = await llm.health()
    return {"status": engine["status"], "service": "faraja", "faraja": engine}


@app.post("/copilot", tags=["Responders / Dashboard"])
async def copilot_endpoint(req: CopilotRequest) -> dict[str, Any]:
    return await copilot.run(req.query, req.intent_hint, req.history, req.context)


@app.post("/reporters/chat", tags=["Reporters"])
async def reporters_chat(req: ReportersChatRequest) -> dict[str, str]:
    messages = [m.model_dump() for m in req.messages]
    reply = await reporters.chat(messages)
    return {"reply": reply}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.APP_HOST, port=settings.APP_PORT,
                reload=settings.APP_ENV == "development")
