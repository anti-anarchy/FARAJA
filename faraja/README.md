# Faraja — the AI service

The single hosted-AI brain for the crisis-mapping stack. No model runs on the
server; inference is hosted (a primary engine + an automatic backup). Users only
ever see "Faraja".

## Endpoints (match what the apps already call)

| Method | Path               | Used by            | Returns |
| ------ | ------------------ | ------------------ | ------- |
| GET    | `/health`          | ops                | engine health by role (no vendor names) |
| POST   | `/copilot`         | dashboard          | `{lines[], actions[], meta}` |
| POST   | `/reporters/chat`  | reporters-app      | `{reply}` |

### `/copilot` (dashboard co-pilot)
Request: `{query, intent_hint, history[], context:{severity, thresholds, points[], zones[], assignments[]}}`
Grounds the answer in the live map snapshot; may propose up to 3 actions
(`fly_to`, `assign`, `apply_thresholds`) using only values present in the context.

### `/reporters/chat` (reporters assistant)
Request: `{messages:[{role, content}]}`. A warm crisis-reporting helper: guides the
reporter, answers safety questions, and **declines + redirects anything off-topic**
(non-crisis). Conservative safety guardrails: general guidance only, always defer to
official emergency services, never medical/legal/structural clearance advice.

## Run

```powershell
cd faraja
python -m venv venv; .\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # paste the two free engine keys
uvicorn app.main:app --port 8088
```

Keys (free, no card): primary → https://aistudio.google.com/apikey ·
backup → https://console.groq.com/keys

Docs: http://localhost:8088/docs

## How the apps connect

```
reporters-app  /api/chat  ──server→  faraja /reporters/chat        (FARAJA_URL)
dashboard      AiAssistant ─browser→  faraja /copilot              (NEXT_PUBLIC_FARAJA_API_URL)
```

Both the reporters chat and the dashboard co-pilot degrade gracefully if Faraja is
unreachable, so the UIs never block.
