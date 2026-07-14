"""
reporters.py
────────────
Reporters-app conversational assistant. Accepts the message history the
ChatBot sends and returns a single {reply}. Scoped to crisis/safety topics with
the same guardrails as the reporter safety guidance; off-topic questions are
politely declined and redirected.
"""

from app import llm
from app.prompts import REPORTERS_SYSTEM

# Cap history so a long chat can't blow the token budget.
_MAX_TURNS = 10


async def chat(messages: list[dict]) -> str:
    """messages: [{role: 'user'|'assistant', content: str}] → assistant reply."""
    convo = [{"role": "system", "content": REPORTERS_SYSTEM}]
    for m in messages[-_MAX_TURNS:]:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            convo.append({"role": role, "content": content})

    if len(convo) == 1:  # nothing usable to respond to
        return ("Hello, I'm Faraja. Tell me what you're seeing and I'll help you "
                "report it and stay safe.")

    try:
        return await llm.chat(convo, temperature=0.4, max_tokens=350)
    except llm.LLMError:
        return ("I'm having trouble responding right now. If anyone is in immediate "
                "danger, please call your local emergency number and follow local "
                "authorities.")
