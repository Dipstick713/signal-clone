"""WebSocket connection manager.

Tracks live sockets per user id (a user may have several open tabs/devices)
and fans a JSON payload out to a set of users. Dead sockets are pruned on the
next send. This is an in-process manager — fine for a single-instance deploy;
a multi-instance deployment would swap this for a Redis pub/sub backplane.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[user_id].add(websocket)

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                self._connections.pop(user_id, None)

    def is_online(self, user_id: int) -> bool:
        return user_id in self._connections

    async def send_to_users(self, user_ids: set[int], payload: dict) -> None:
        """Send a JSON payload to every live socket of the given users."""
        targets: list[tuple[int, WebSocket]] = []
        async with self._lock:
            for uid in user_ids:
                for ws in self._connections.get(uid, set()):
                    targets.append((uid, ws))

        dead: list[tuple[int, WebSocket]] = []
        for uid, ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append((uid, ws))

        if dead:
            async with self._lock:
                for uid, ws in dead:
                    self._connections.get(uid, set()).discard(ws)


manager = ConnectionManager()
