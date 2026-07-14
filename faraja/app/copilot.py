"""
copilot.py
──────────
Dashboard/responder co-pilot. Grounds the LLM in the live map snapshot the
dashboard sends, and returns {lines, actions, meta} matching the contract in
dashboard/src/components/AiAssistant.tsx.

Actions are validated against what the model may return; anything malformed is
dropped so the dashboard only ever receives usable actions.
"""

from app import llm
from app.prompts import COPILOT_SYSTEM, copilot_user_prompt

_VALID_ACTION_TYPES = {"fly_to", "assign", "apply_thresholds"}


def _clean_actions(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for a in raw[:3]:
        if not isinstance(a, dict):
            continue
        t = a.get("type")
        if t not in _VALID_ACTION_TYPES:
            continue
        label = str(a.get("label", "")).strip() or t.replace("_", " ")
        if t == "fly_to":
            if isinstance(a.get("lat"), (int, float)) and isinstance(a.get("lng"), (int, float)):
                out.append({"type": "fly_to", "label": label,
                            "lat": float(a["lat"]), "lng": float(a["lng"])})
        elif t == "assign":
            if a.get("zone_id"):
                out.append({"type": "assign", "label": label, "zone_id": str(a["zone_id"])})
        elif t == "apply_thresholds":
            if isinstance(a.get("low"), (int, float)) and isinstance(a.get("crit"), (int, float)):
                low = max(0, min(100, int(a["low"])))
                crit = max(0, min(100, int(a["crit"])))
                out.append({"type": "apply_thresholds", "label": label, "low": low, "crit": crit})
    return out


async def run(query: str, intent_hint: str, history: list[dict], context: dict) -> dict:
    """Return {lines, actions, meta}. Never raises — degrades to a safe reply."""
    grounded = bool(context) and bool(context.get("points") or context.get("zones"))
    try:
        result = await llm.json(
            [{"role": "system", "content": COPILOT_SYSTEM},
             {"role": "user", "content": copilot_user_prompt(query, intent_hint, history, context)}],
            temperature=0.2, max_tokens=700,
        )
        lines = result.get("lines")
        if not isinstance(lines, list) or not lines:
            raise llm.LLMError("empty lines")
        lines = [str(x) for x in lines if str(x).strip()][:5]
        if not lines:
            raise llm.LLMError("empty lines")
        return {
            "lines": lines,
            "actions": _clean_actions(result.get("actions")),
            "meta": {"intent": intent_hint, "grounded": grounded},
        }
    except llm.LLMError:
        # The dashboard also has its own local fallback, but return a usable
        # shape rather than an error so the contract always holds.
        total = (context or {}).get("severity", {}).get("total_reports", 0)
        return {
            "lines": [
                "I can't reach my analysis engine right now.",
                f"There {'is' if total == 1 else 'are'} {total} report{'' if total == 1 else 's'} in the current view.",
                "Try again in a moment, or use the map filters directly.",
            ],
            "actions": [],
            "meta": {"intent": intent_hint, "grounded": grounded},
        }
