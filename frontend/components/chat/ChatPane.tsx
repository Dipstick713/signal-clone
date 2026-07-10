"use client";

/**
 * Right-hand chat pane for the selected conversation.
 *
 * Renders the header, the scrollable thread (date separators, sender grouping,
 * system notices, and status ticks on your own messages) and a live composer
 * that sends over the WebSocket. Messages send optimistically and reconcile
 * when the server echoes them back.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { useChat, type ChatMessage, type MessageStatus } from "@/lib/chat-store";
import { formatDateSeparator, formatTime, isDifferentDay } from "@/lib/format";
import { useAuth } from "@/lib/store";
import type { User } from "@/lib/types";

export function ChatPane() {
  const meId = useAuth((s) => s.user?.id);
  const selectedId = useChat((s) => s.selectedId);
  const detail = useChat((s) => s.detail);
  const messages = useChat((s) => s.messages);
  const loading = useChat((s) => s.loadingMessages);
  const wsStatus = useChat((s) => s.wsStatus);
  const sendMessage = useChat((s) => s.sendMessage);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const usersById = useMemo(() => {
    const m = new Map<number, User>();
    detail?.participants.forEach((p) => m.set(p.user.id, p.user));
    return m;
  }, [detail]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [selectedId, messages.length]);

  function submit() {
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  }

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

      {wsStatus !== "open" && (
        <div className="bg-amber-500/15 px-4 py-1 text-center text-xs text-amber-600 dark:text-amber-400">
          {wsStatus === "connecting" ? "Connecting…" : "Reconnecting…"}
        </div>
      )}

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
                <div key={m.temp_id ?? m.id}>
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

      {/* Composer */}
      <footer className="border-t border-border px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Message"
            className="max-h-32 flex-1 resize-none rounded-2xl bg-hover px-4 py-2.5 text-sm outline-none placeholder:text-secondary focus:ring-1 focus:ring-signal"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal text-white transition hover:bg-signal-hover disabled:opacity-40"
          >
            <SendIcon />
          </button>
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
  message: ChatMessage;
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
          mine ? "bg-signal text-white" : "bg-bubble-in text-primary"
        }`}
      >
        {showSender && senderName && (
          <p className="mb-0.5 text-xs font-semibold" style={{ color: senderColor }}>
            {senderName}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        <div
          className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
            mine ? "text-white/70" : "text-secondary"
          }`}
        >
          <span>{formatTime(message.created_at)}</span>
          {mine && <StatusTicks status={message.status ?? "sent"} />}
        </div>
      </div>
    </div>
  );
}

/** Signal-style delivery ticks: clock → single check → double check (blue=read). */
function StatusTicks({ status }: { status: MessageStatus }) {
  if (status === "sending") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="sending">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l2.5 2.5" strokeLinecap="round" />
      </svg>
    );
  }
  const isDouble = status === "delivered" || status === "read";
  const color = status === "read" ? "#7cc0ff" : "currentColor";
  return (
    <svg width="16" height="12" viewBox="0 0 20 12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label={status}>
      <path d="M2 6.5 5.5 10 12 3" />
      {isDouble && <path d="M9 10 15.5 3" />}
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2z" />
    </svg>
  );
}
