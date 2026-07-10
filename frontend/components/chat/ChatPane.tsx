"use client";

/**
 * Right-hand chat pane for the selected conversation.
 *
 * Renders a header (avatar, title, member/username subtitle), the scrollable
 * message thread with date separators, sender grouping, and system notices,
 * and a composer. In this phase the composer is a read-only preview — sending
 * and real-time delivery are wired up in the next phase.
 */
import { useEffect, useMemo, useRef } from "react";

import { Avatar } from "@/components/Avatar";
import { useChat } from "@/lib/chat-store";
import { formatDateSeparator, formatTime, isDifferentDay } from "@/lib/format";
import { useAuth } from "@/lib/store";
import type { Message, User } from "@/lib/types";

export function ChatPane() {
  const meId = useAuth((s) => s.user?.id);
  const selectedId = useChat((s) => s.selectedId);
  const detail = useChat((s) => s.detail);
  const messages = useChat((s) => s.messages);
  const loading = useChat((s) => s.loadingMessages);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Map of participant id -> user, for sender names/colours in group chats.
  const usersById = useMemo(() => {
    const m = new Map<number, User>();
    detail?.participants.forEach((p) => m.set(p.user.id, p.user));
    return m;
  }, [detail]);

  // Auto-scroll to the newest message when a conversation loads.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [selectedId, messages.length]);

  if (selectedId === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-signal text-2xl text-on-accent">
            💬
          </div>
          <h2 className="text-xl font-semibold">Signal Clone</h2>
          <p className="max-w-xs text-sm text-secondary">
            Select a conversation to start messaging. End-to-end encryption is
            simulated for this demo.
          </p>
        </div>
      </main>
    );
  }

  const isGroup = detail?.type === "group";
  const subtitle = isGroup
    ? `${detail?.participants.length ?? 0} members`
    : detail?.other_user
      ? `@${detail.other_user.username}`
      : "";

  return (
    <main className="flex flex-1 flex-col bg-app">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        {detail && (
          <Avatar
            name={detail.title}
            color={detail.avatar_color ?? "#6b6b6b"}
            url={detail.avatar_url}
            size={38}
          />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{detail?.title ?? "…"}</p>
          <p className="truncate text-xs text-secondary">{subtitle}</p>
        </div>
      </header>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading && messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-secondary">Loading…</p>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-0.5">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const showDate = !prev || isDifferentDay(prev.created_at, m.created_at);
              const mine = m.sender_id === meId;
              // Group consecutive messages from the same sender.
              const grouped =
                !!prev &&
                prev.sender_id === m.sender_id &&
                prev.type === "text" &&
                !showDate;

              if (m.type === "system") {
                return (
                  <div key={m.id}>
                    {showDate && <DateSeparator iso={m.created_at} />}
                    <p className="my-2 text-center text-xs text-secondary">{m.body}</p>
                  </div>
                );
              }

              const sender = m.sender_id ? usersById.get(m.sender_id) : undefined;
              return (
                <div key={m.id}>
                  {showDate && <DateSeparator iso={m.created_at} />}
                  <MessageBubble
                    message={m}
                    mine={mine}
                    grouped={grouped}
                    showSender={isGroup && !mine && !grouped}
                    senderName={sender?.display_name}
                    senderColor={sender?.avatar_color}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer (read-only preview in this phase) */}
      <footer className="border-t border-border px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            disabled
            placeholder="Message"
            className="flex-1 rounded-full bg-hover px-4 py-2.5 text-sm outline-none placeholder:text-secondary disabled:cursor-not-allowed"
          />
          <span className="text-xs text-secondary">🔒 simulated</span>
        </div>
      </footer>
    </main>
  );
}

function DateSeparator({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-hover px-3 py-1 text-xs text-secondary">
        {formatDateSeparator(iso)}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  grouped,
  showSender,
  senderName,
  senderColor,
}: {
  message: Message;
  mine: boolean;
  grouped: boolean;
  showSender: boolean;
  senderName?: string;
  senderColor?: string;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
          mine
            ? "bg-signal text-white"
            : "bg-bubble-in text-primary"
        }`}
      >
        {showSender && senderName && (
          <p className="mb-0.5 text-xs font-semibold" style={{ color: senderColor }}>
            {senderName}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        <p
          className={`mt-0.5 text-right text-[10px] ${
            mine ? "text-white/70" : "text-secondary"
          }`}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
