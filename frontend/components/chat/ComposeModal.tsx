"use client";

/**
 * "New chat" modal: search the user directory and start a 1:1 conversation.
 * (Group creation is added in a later phase.) Debounces the search query and
 * lists matching users; selecting one opens/creates the direct conversation.
 */
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import { useChat } from "@/lib/chat-store";
import type { User } from "@/lib/types";

export function ComposeModal({ onClose }: { onClose: () => void }) {
  const startDirect = useChat((s) => s.startDirect);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Debounced directory search (runs once on mount with an empty query too).
  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await api.searchUsers(query));
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  async function pick(user: User) {
    setBusyId(user.id);
    try {
      await startDirect(user.id);
      onClose();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">New chat</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 text-secondary transition hover:text-primary"
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or @username"
            className="w-full rounded-lg border border-border bg-app px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>

        <div className="max-h-80 overflow-y-auto px-1 pb-2">
          {loading && results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-secondary">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-secondary">
              No users found.
            </p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                onClick={() => pick(u)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-hover disabled:opacity-60"
              >
                <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.display_name}</p>
                  <p className="truncate text-xs text-secondary">@{u.username}</p>
                </div>
                {busyId === u.id && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-signal border-t-transparent" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
