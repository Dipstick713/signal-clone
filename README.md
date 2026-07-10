# Signal Clone

A functional clone of the [Signal](https://signal.org) messenger — recreating
Signal's design, UX, and core messaging workflows. Real-time 1:1 and group
chat, delivery/read receipts, typing indicators, and presence. End-to-end
encryption is **simulated** (per the assignment brief), not cryptographically real.

> **Status:** Feature-complete — all core features plus bonus reactions, replies,
> and image attachments. See the [build phases](#build-phases) below.

<!-- After deploying, fill these in: -->
**🔗 Live demo:** _add your Vercel URL_ · **API:** _add your Render URL_

> Sign in with any seeded username (e.g. **alice**, **bob**, **carol**) and OTP **123456**.

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
| PATCH  | `/api/conversations/{id}`             | Rename a group (admin)               |
| GET    | `/api/conversations/{id}/messages`    | Paginated history (`?before=&limit=`)|
| POST   | `/api/conversations/{id}/read`        | Advance read watermark               |
| POST   | `/api/conversations/{id}/members`     | Add members to a group (admin)       |
| DELETE | `/api/conversations/{id}/members/{u}` | Remove member (admin) / leave (self) |
| WS     | `/ws?token=<jwt>`                     | Realtime channel (see events below)  |

### WebSocket events

Sending goes over the socket so delivery is instant and one channel carries all
live traffic. Messages are sent optimistically and reconciled on echo.

```
client → server   { "type": "message.send", "conversation_id", "body", "temp_id"? }
                  { "type": "receipt.delivered" | "receipt.read", "conversation_id", "message_id" }
                  { "type": "typing.start" | "typing.stop", "conversation_id" }
server → client   { "type": "message.new", "temp_id"?, "message": { … } }
                  { "type": "receipt.update", "conversation_id", "user_id", "kind", "message_id" }
                  { "type": "typing.update", "conversation_id", "user_id", "is_typing" }
                  { "type": "presence.update", "user_id", "is_online", "last_seen" }
                  { "type": "presence.snapshot", "user_ids": [ … ] }   // online contacts, on connect
                  { "type": "error", "detail": "…" }
```

- **Receipts** advance per-participant `last_delivered` / `last_read` watermarks;
  the sender derives a message's tick (sent → delivered → read) by comparing
  those watermarks against the message id.
- **Presence** is driven by live socket connect/disconnect and announced only to
  users who share a conversation with you.

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

## Deployment

The frontend deploys to **Vercel** and the backend to **Render** (free tier).

### Backend → Render

Either use the included `render.yaml` blueprint (Dashboard → New → Blueprint →
this repo) or create a Web Service manually:

- **Root directory:** `backend`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health check path:** `/api/health`
- **Env vars:** `JWT_SECRET` (any random string), `MOCK_OTP=123456`,
  `CORS_ORIGINS=https://<your-vercel-app>.vercel.app`,
  `CORS_ORIGIN_REGEX=https://.*\.vercel\.app`

> **Note:** the free tier has an ephemeral disk, so the SQLite DB resets on
> redeploy/restart. The app auto-seeds demo data on an empty database
> (`SEED_ON_STARTUP`), so it's always usable. For durable storage, attach a
> Render persistent disk or point `DATABASE_URL` at Postgres.

### Frontend → Vercel

- **Root directory:** `frontend`
- **Env var:** `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com`
  (the client derives the WebSocket URL from this — `https` → `wss`)
- Framework preset: Next.js (build/output auto-detected)

After both are live, set the backend's `CORS_ORIGINS` to the Vercel URL and
redeploy.

## Build Phases

1. **Scaffold** — repos, FastAPI + SQLite, Next.js + Tailwind, health check ✅
2. **Auth & onboarding** — mock OTP, display name, avatar, session persistence ✅
3. **Conversations** — list, search, contacts, seeded message history ✅
4. **1:1 messaging** — WebSocket live send/receive, optimistic status ticks ✅
5. **Receipts, typing, presence** — double-check receipts, typing dots, online/last-seen ✅
6. **Group messaging** — creation, member management, admin controls ✅
7. **Signal experience pass** — nav rail, settings, toasts, dark mode, responsive, shortcuts ✅
8. **Bonus + deploy** — emoji reactions, replies, image attachments; Render + Vercel ✅

## Placeholders ("Coming soon")

Voice/video **Calls**, **Stories**, and **Linked devices** are present as
"Coming soon" modals (reachable from the nav rail and Settings). Encryption is
simulated — a `🔒 simulated` marker stands in for real E2E crypto.

## Assumptions

- Encryption is mocked/simulated; no real cryptographic key exchange.
- Accounts are identified by **username** with a fixed mock OTP (no real SMS).
- Online/last-seen is derived from live WebSocket connections.
- **Bonus delivered:** emoji reactions, reply/quoted messages, image
  attachments, dark mode, responsive (mobile/tablet/desktop), and a keyboard
  shortcut (⌘/Ctrl-K to start a new chat).
- Attachment bytes are stored in the database and served publicly by id (so
  `<img>` can load them); a production build would use signed object-storage URLs.

_Database schema and API overview will be documented as those layers land._
