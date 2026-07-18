# Pulse — Live Polling Tool

A full-stack live polling app: create a poll, share a link, and watch votes update in real time with no page refresh.

**Live app:** https://live-polling-tool.vercel.app
**Backend API:** https://live-polling-tool-backend.onrender.com/api

> **Note on the backend link:** it's hosted on Render's free tier, which spins down after 15 minutes of inactivity. The first request after a period of idle time can take 30–60 seconds to wake up — this is a free-tier limitation, not a bug. Give it a moment on first load.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React (Vite) |
| Backend | Go (Gin) |
| Database | MongoDB (Atlas) |
| Realtime | Redis (Render Key Value) |
| Auth | JWT + bcrypt |
| Deployment | Backend on Render, Frontend on Vercel |

---

## How it works

1. A user signs up / logs in and creates a poll (question + options).
2. They share the generated link.
3. Anyone with the link can vote — no account needed.
4. Anyone watching the poll's results page is connected via WebSocket and sees vote counts update live as they come in.

**Flow:** Create poll → Share link → Audience votes → Live results

---

## Running it locally

### Prerequisites
- Go 1.22+
- Node.js 18+
- A MongoDB connection (local via Docker, or a free MongoDB Atlas cluster)
- A Redis connection (local via Docker, or a free Redis instance)

### Backend
```bash
cd backend
cp .env.example .env   # fill in your Mongo URI, Redis address, and a JWT secret
go mod tidy
go run cmd/main.go
```
Runs on `http://localhost:8080`.

### Frontend
```bash
cd frontend
cp .env.example .env   # points VITE_API_URL at your backend
npm install
npm run dev
```
Runs on `http://localhost:5173`.

---

## Key decisions

**Why Redis holds the vote counts, not MongoDB.**
MongoDB stores each poll's definition — the question, the options, who owns it. It does *not* store live vote counts. Those live in a Redis hash, one field per option, incremented with `HINCRBY` on every vote. `HINCRBY` is atomic, so concurrent votes from many people at once never overwrite each other or lose a vote. Redis is also just faster for this — it's an in-memory write versus a disk-backed database round trip, and vote counting is exactly the kind of hot, frequent-write path that benefits from that.

**How the live updates actually reach the browser.**
When a vote comes in, the backend increments Redis, then publishes the fresh totals on a Redis pub/sub channel scoped to that poll. A subscriber goroutine (started once, at server startup) listens for these and forwards them to a `Hub` that tracks every open WebSocket connection per poll. The Hub broadcasts the update to everyone currently watching that poll's results page. Routing through Redis pub/sub instead of updating connected clients directly matters if this were ever deployed across multiple backend instances behind a load balancer — any instance can receive a vote and every instance's connected clients still get notified.

**Auth is intentionally asymmetric.**
Creating and managing polls requires a signed-up account (JWT-based, bcrypt-hashed passwords, 7-day token expiry). Voting and watching results do not — they're public by link, since anyone with the link should be able to vote. Requiring an account to vote would work against the core use case.

---

## Project structure
```
/frontend   > React app (Vite)
/backend    > Go service (Gin)
```
See `backend/internal/` for the Go package layout — split into `db`, `models`, `handlers`, `middleware`, `ws`, and `routes`, each owning one responsibility.
