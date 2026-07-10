"use client";

/**
 * Left-rail conversation list: user header, search box, "new chat" action,
 * and the list of conversations (avatar, title, last-message preview,
 * timestamp, unread badge) sorted by recent activity.
 *
 * The search box filters the loaded conversations locally by title; the
 * "compose" button (top-right) opens a modal to find users and start new chats.
 */
import { useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { useChat } from "@/lib/chat-store";
import { formatListTime } from "@/lib/format";
import { useAuth } from "@/lib/store";

export function ConversationList({
  onCompose,
  onSettings,
}: {
  onCompose: () => void;
  onSettings: () => void;
}) {
  const user = useAuth((s) => s.user);
  const conversations = useChat((s) => s.conversations);
  const selectedId = useChat((s) => s.selectedId);
  const select = useChat((s) => s.select);
  const loading = useChat((s) => s.loadingList);
  const presence = useChat((s) => s.presence);

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <aside
      className={`${
        selectedId !== null ? "hidden md:flex" : "flex"
      } w-full shrink-0 flex-col border-r border-border bg-panel md:w-80`}
    >
      {/* User header */}
      <header className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={onSettings}
          title="Settings"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:opacity-80"
        >
          {user && (
            <Avatar
              name={user.display_name}
              color={user.avatar_color}
              url={user.avatar_url}
              size={36}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.display_name}</p>
            <p className="truncate text-xs text-secondary">@{user?.username}</p>
          </div>
        </button>
        <button
          onClick={onCompose}
          title="New chat (⌘K)"
          aria-label="New chat"
          className="flex h-8 w-8 items-center justify-center rounded-full text-secondary transition hover:bg-hover hover:text-primary"
        >
          <PencilIcon />
        </button>
      </header>

      {/* Search */}
      <div className="px-3 pb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="w-full rounded-full bg-hover px-4 py-2 text-sm outline-none placeholder:text-secondary focus:ring-1 focus:ring-signal"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-secondary">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-6 text-center text-sm text-secondary">
            {query ? "No matches." : "No conversations yet."}
          </p>
        ) : (
          filtered.map((c) => {
            const preview = c.last_message?.body ?? "No messages yet";
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                  active ? "bg-signal/10" : "hover:bg-hover"
                }`}
              >
                <Avatar
                  name={c.title}
                  color={c.avatar_color ?? "#6b6b6b"}
                  url={c.avatar_url}
                  size={44}
                  online={c.other_user ? presence[c.other_user.id]?.online : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{c.title}</span>
                    <span className="shrink-0 text-xs text-secondary">
                      {c.last_message ? formatListTime(c.last_message.created_at) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-secondary">{preview}</span>
                    {c.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-signal px-1.5 text-xs font-medium text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
