"""Seed the database with demo users, conversations, and messages.

Run from the backend/ directory:  python seed.py

Idempotent-ish: it drops and recreates all tables so the demo state is
deterministic. Every seeded user signs in with the fixed mock OTP (123456).
"""
from datetime import datetime, timedelta, timezone

from app.core.constants import color_for
from app.core.database import Base, SessionLocal, engine
from app.models.conversation import Conversation, Participant
from app.models.message import Message
from app.models.user import User

# (username, display_name, about)
USERS = [
    ("alice", "Alice Johnson", "In the garden 🌿"),
    ("bob", "Bob Martinez", "Available"),
    ("carol", "Carol Nguyen", "Working from home"),
    ("dave", "Dave Patel", "Cycling 🚴"),
    ("erin", "Erin O'Neil", "Coffee first ☕"),
    ("frank", "Frank Weber", "Do not disturb"),
]

# Direct conversations: (user_a, user_b, [(sender, text, minutes_ago), ...])
DIRECTS = [
    (
        "alice",
        "bob",
        [
            ("bob", "Hey Alice! Are we still on for lunch tomorrow?", 240),
            ("alice", "Yes! Noon at the usual place?", 236),
            ("bob", "Perfect. I'll book a table.", 235),
            ("alice", "Great, see you then 😊", 12),
        ],
    ),
    (
        "alice",
        "carol",
        [
            ("carol", "Did you get the design files?", 180),
            ("alice", "Just downloaded them, thanks!", 175),
            ("carol", "Let me know what you think", 174),
        ],
    ),
    (
        "alice",
        "dave",
        [
            ("dave", "That bike route was brutal 😅", 90),
            ("alice", "Ha! How far did you go?", 60),
        ],
    ),
]

# Group conversations: (name, admin, [members], [(sender, text, minutes_ago)])
GROUPS = [
    (
        "Weekend Trip 🏔️",
        "alice",
        ["alice", "bob", "carol", "dave"],
        [
            ("alice", "Okay team, who's driving?", 300),
            ("dave", "I can take my car, fits 4", 295),
            ("carol", "I'll bring snacks 🍫", 290),
            ("bob", "Cabin is booked for Saturday!", 200),
            ("alice", "Amazing. Can't wait 🎉", 30),
        ],
    ),
    (
        "Design Team",
        "carol",
        ["carol", "alice", "erin"],
        [
            ("carol", "New mockups are in Figma", 500),
            ("erin", "Looking now", 480),
            ("alice", "The color palette is 🔥", 475),
        ],
    ),
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def seed() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        users: dict[str, User] = {}
        for username, display_name, about in USERS:
            u = User(
                username=username,
                display_name=display_name,
                about=about,
                avatar_color=color_for(username),
                last_seen_at=_utcnow(),
            )
            db.add(u)
            users[username] = u
        db.commit()
        for u in users.values():
            db.refresh(u)

        def add_messages(conv: Conversation, script):
            """Attach messages with increasing timestamps; bump conv.updated_at."""
            newest = None
            for sender, text, minutes_ago in script:
                ts = _utcnow() - timedelta(minutes=minutes_ago)
                m = Message(
                    conversation_id=conv.id,
                    sender_id=users[sender].id if sender else None,
                    body=text,
                    type="text" if sender else "system",
                    created_at=ts,
                )
                db.add(m)
                newest = ts if newest is None else max(newest, ts)
            if newest is not None:
                conv.updated_at = newest

        # Direct conversations
        for a, b, script in DIRECTS:
            conv = Conversation(type="direct", created_at=_utcnow())
            conv.participants = [
                Participant(user_id=users[a].id),
                Participant(user_id=users[b].id),
            ]
            db.add(conv)
            db.commit()
            db.refresh(conv)
            add_messages(conv, script)
            db.commit()

        # Group conversations
        for name, admin, members, script in GROUPS:
            conv = Conversation(
                type="group",
                name=name,
                avatar_color=color_for(name),
                created_by=users[admin].id,
                created_at=_utcnow(),
            )
            conv.participants = [
                Participant(
                    user_id=users[m].id,
                    role="admin" if m == admin else "member",
                )
                for m in members
            ]
            # A leading system message, then the scripted chat.
            system = Message(
                sender_id=None,
                type="system",
                body=f"{users[admin].display_name} created the group",
                created_at=_utcnow() - timedelta(minutes=script[0][2] + 5),
            )
            conv.messages = [system]
            db.add(conv)
            db.commit()
            db.refresh(conv)
            add_messages(conv, script)
            db.commit()

        print(f"Seeded {len(users)} users, "
              f"{len(DIRECTS)} direct + {len(GROUPS)} group conversations.")
        print("All users sign in with OTP 123456. Try username 'alice'.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
