# Signal Clone

A functional clone of the [Signal](https://signal.org) messenger — recreating
Signal's design, UX, and core messaging workflows. Real-time 1:1 and group
chat, delivery/read receipts, typing indicators, and presence. End-to-end
encryption is **simulated** (per the assignment brief), not cryptographically real.

> **Status:** Phase 3 — conversations, contacts, and message history. See the
> [build phases](#build-phases) below.

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

## Database Schema

One unified `Conversation` model backs both 1:1 and group chats — a direct chat
is a conversation of `type="direct"` with exactly two participants.

```
users                              conversations
─────                              ─────────────
id            PK                   id             PK
username      unique              type           "direct" | "group"
display_name                      name           (groups)
avatar_color                      avatar_color / avatar_url
avatar_url                        created_by     FK → users.id
about                             created_at
last_seen_at                      updated_at     ← bumped on new message (list sort)
created_at

participants                       messages
────────────                       ────────
id                    PK           id                 PK
conversation_id       FK           conversation_id    FK → conversations.id
user_id               FK           sender_id          FK → users.id (null = system)
role     "admin"|"member"          body
last_read_message_id  ← unread     type    "text" | "system"
joined_at              watermark   reply_to_id        FK → messages.id (quoted reply)
                                   created_at / edited_at / deleted_at (soft delete)
```

- **Unread counts & read receipts** come from `participants.last_read_message_id`
  (a per-user watermark) instead of a row per message per user.
- Cascade deletes remove a conversation's participants and messages together.

## API Overview

| Method | Path                                  | Description                          |
| ------ | ------------------------------------- | ------------------------------------ |
| POST   | `/api/auth/start`                     | New vs. returning username           |
| POST   | `/api/auth/verify`                    | Verify OTP → register/login (JWT)    |
| GET    | `/api/auth/me`                        | Current user (session restore)       |
| GET    | `/api/users/me`, PATCH `/api/users/me`| Get / update profile                 |
| GET    | `/api/users/search?q=`                | Find users to message                |
| GET    | `/api/conversations`                  | List (preview, unread, recency sort) |
| POST   | `/api/conversations/direct`           | Open/create a 1:1 chat               |
| POST   | `/api/conversations/group`            | Create a group                       |
| GET    | `/api/conversations/{id}`             | Conversation detail + participants   |
| GET    | `/api/conversations/{id}/messages`    | Paginated history (`?before=&limit=`)|
| POST   | `/api/conversations/{id}/read`        | Advance read watermark               |

## Getting Started

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional; sensible defaults exist
python seed.py                  # seed demo users + conversations
uvicorn app.main:app --reload   # serves on http://localhost:8000
```

Health check: <http://localhost:8000/api/health>. All seeded users sign in with
OTP **123456** — try username **alice**.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # points at the backend
npm run dev                         # serves on http://localhost:3000
```

## Build Phases

1. **Scaffold** — repos, FastAPI + SQLite, Next.js + Tailwind, health check ✅
2. **Auth & onboarding** — mock OTP, display name, avatar, session persistence ✅
3. **Conversations** — list, search, contacts, seeded message history ✅
4. 1:1 messaging — WebSocket live send/receive, status ticks
5. Receipts, typing indicators, presence
6. Group messaging — creation, members, admin controls
7. Signal experience pass — modals, search, toasts, settings, dark mode
8. Bonus features, deploy, and documentation

## Assumptions

- Encryption is mocked/simulated; no real cryptographic key exchange.
- Accounts are identified by **username** with a fixed mock OTP (no real SMS).
- Online/last-seen is derived from live WebSocket connections.

_Database schema and API overview will be documented as those layers land._
