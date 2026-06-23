# Crisis Mapping — Survey Queue

An Express API that receives crisis survey reports, queues them with **BullMQ** backed by Redis, processes them across **5 concurrent workers**, and exposes a live monitoring dashboard via **Bull Board**.

---

## Architecture

```
POST /survey
     │
     ▼
Express API  ──►  BullMQ Queue (Redis)  ──►  Worker 1
                                         ──►  Worker 2
                                         ──►  Worker 3
                                         ──►  Worker 4
                                         ──►  Worker 5
GET /admin/queues
     │
     ▼
Bull Board UI (real-time job monitor)
```

| Component | Role |
|-----------|------|
| **Express** | Accepts `POST /survey` and serves Bull Board at `/admin/queues` |
| **BullMQ Queue** | Durable job queue stored in Redis |
| **5 Workers** | Pick up jobs, wait 10 s, then log the survey payload |
| **Bull Board** | Web UI to inspect waiting / active / completed / failed jobs |
| **Redis** | Persistent queue storage (AOF enabled) |

---

## Prerequisites

- [Node.js 20+](https://nodejs.org/) (for local development)
- [Docker](https://www.docker.com/) and Docker Compose (for containerised run)

---

## Quick Start — Docker (recommended)

```bash
# Build the image and start Redis + app
docker compose up --build

# Or run detached
docker compose up --build -d
```

The API will be available at `http://localhost:3000` once the `crisis-app` container reports healthy.

To stop and remove containers:

```bash
docker compose down          # keep Redis volume
docker compose down -v       # also delete Redis data
```

---

## Quick Start — Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start Redis (Docker, one-liner)
docker run -d -p 6379:6379 --name crisis-redis redis:7-alpine

# 3. Run in watch mode
npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `PORT` | `3000` | HTTP server port |

When running via Docker Compose these are already configured. For local development create an `.env` file in the project root if needed:

```
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
```

---

## API Reference

### `POST /survey`

Submit a crisis survey report. The job is immediately queued and acknowledged; workers process it asynchronously.

**Request body** (`Content-Type: application/json`):

```jsonc
{
  "incidentType": "earthquake",       // required — e.g. "earthquake", "flood", "fire"
  "infrastructure": ["bridge", "road"], // optional — affected infrastructure types
  "otherText": "",                    // optional — free-text for "other" infrastructure
  "infraName": "Uhuru Highway",       // optional — name of specific infrastructure
  "infraCount": "3",                  // optional — number of affected units
  "damageLevel": "severe",            // optional — e.g. "minor", "moderate", "severe"
  "debris": "yes",                    // optional — presence of debris
  "description": "Multiple buildings collapsed near CBD",
  "location": [36.8219, -1.2921]      // optional — [longitude, latitude] or null
}
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `202 Accepted` | Survey queued. Body contains `jobId` and dashboard URL. |
| `400 Bad Request` | Validation failed. Body contains `error` message. |

**Example `202` response:**

```json
{
  "message": "Survey queued successfully",
  "jobId": "survey-1717852345678-ab3f2",
  "queueDashboard": "http://localhost:3000/admin/queues"
}
```

**cURL example:**

```bash
curl -X POST http://localhost:3000/survey \
  -H "Content-Type: application/json" \
  -d '{
    "incidentType": "earthquake",
    "infrastructure": ["bridge"],
    "damageLevel": "severe",
    "description": "Bridge cracked after 5.8 magnitude quake",
    "location": [36.8219, -1.2921]
  }'
```

---

### `GET /health`

Liveness check.

```json
{ "status": "ok", "timestamp": "2026-06-08T10:00:00.000Z" }
```

---

### `GET /admin/queues`

Opens the **Bull Board** web UI — no authentication required in development. Shows:

- **Waiting** — jobs queued, not yet picked up
- **Active** — currently being processed by a worker
- **Completed** — successfully processed jobs (last 100 retained)
- **Failed** — jobs that exhausted all retry attempts (last 50 retained)
- **Delayed** — jobs scheduled for future execution
- **Paused** — manually paused jobs

---

## Workers

Five worker instances are started in the same process as the API server. Each worker:

1. Picks up the next available job from the `survey` queue.
2. Sleeps for **10 seconds** (simulating processing time).
3. Logs the full survey payload to stdout.
4. Marks the job `completed`.

Failed jobs are automatically retried **3 times** with exponential back-off starting at 2 seconds.

Worker output example:

```
[Worker 3] Starting job survey-1717852345678-ab3f2 (attempt 1)
[Worker 3] Completed job survey-1717852345678-ab3f2 — survey data:
{
  "incidentType": "earthquake",
  "infrastructure": ["bridge"],
  ...
}
[Worker 3] Job survey-1717852345678-ab3f2 marked completed
```

---

## Project Structure

```
.
├── src/
│   ├── server.ts      # Express app, Bull Board, POST /survey
│   ├── queue.ts       # BullMQ Queue definition
│   ├── workers.ts     # 5 Worker instances
│   ├── redis.ts       # Shared Redis connection options
│   └── types.ts       # SurveyData interface
├── Dockerfile         # Multi-stage build (builder → runner)
├── docker-compose.yml # Redis + app services
├── .dockerignore
├── tsconfig.json
└── package.json
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot-reload (ts-node-dev) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |

---

## Scaling

To run additional worker replicas as separate Docker containers (stateless — they all connect to the same Redis queue):

```bash
docker compose up --scale app=3
```

Note: expose different host ports if scaling on a single machine — update `docker-compose.yml` to remove the fixed host port binding on `app` when doing this.
