# Signal Clone

A functional clone of the [Signal](https://signal.org) messenger — recreating
Signal's design, UX, and core messaging workflows. Real-time 1:1 and group
chat, delivery/read receipts, typing indicators, and presence. End-to-end
encryption is **simulated** (per the assignment brief), not cryptographically real.

> **Status:** Phase 1 — project scaffold. See the [build phases](#build-phases) below.

## Tech Stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Frontend   | Next.js 16 (App Router, TypeScript) + Tailwind CSS v4 |
| Backend    | FastAPI (Python) + SQLAlchemy                       |
| Database   | SQLite                                              |
| Real-time  | WebSockets                                          |
| Auth       | Mocked username + fixed OTP, JWT sessions           |

## Architecture

```
frontend/ (Next.js)  ──REST──▶  backend/ (FastAPI)  ──▶  SQLite
          │                                │
          └──────────  WebSocket  ─────────┘
```

- **REST** handles request/response work: auth, conversation lists, paginated
  message history, group/member CRUD.
- **WebSocket** handles live events: new messages, typing indicators,
  delivery/read receipts, and presence.

## Repository Layout

```
signal-clone/
├── backend/    FastAPI app, SQLAlchemy models, WebSocket manager, DB seed
├── frontend/   Next.js App Router UI (Signal-styled)
└── README.md
```

## Getting Started

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional; sensible defaults exist
uvicorn app.main:app --reload   # serves on http://localhost:8000
```

Health check: <http://localhost:8000/api/health>

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # points at the backend
npm run dev                         # serves on http://localhost:3000
```

## Build Phases

1. **Scaffold** — repos, FastAPI + SQLite, Next.js + Tailwind, health check ✅
2. Auth & onboarding (mock OTP, display name, avatar, session persistence)
3. App shell — conversation list, seed data
4. 1:1 messaging — REST history + WebSocket live send/receive, status ticks
5. Receipts, typing indicators, presence
6. Group messaging — creation, members, admin controls
7. Signal experience pass — modals, search, toasts, settings, dark mode
8. Bonus features, deploy, and documentation

## Assumptions

- Encryption is mocked/simulated; no real cryptographic key exchange.
- Accounts are identified by **username** with a fixed mock OTP (no real SMS).
- Online/last-seen is derived from live WebSocket connections.

_Database schema and API overview will be documented as those layers land._
