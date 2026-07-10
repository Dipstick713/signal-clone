"use client";

/**
 * Right-hand chat pane for the selected conversation.
 *
 * Renders the header (with live presence / typing subtitle), the scrollable
 * thread (date separators, sender grouping, system notices, and delivery/read
 * ticks on your own messages), a typing indicator, and a composer that sends
 * over the WebSocket and emits typing events.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { GroupInfoModal } from "@/components/chat/GroupInfoModal";
import {
  useChat,
  type ChatMessage,
  type MessageStatus,
  type Receipt,
} from "@/lib/chat-store";
import { formatDateSeparator, formatLastSeen, formatTime, isDifferentDay } from "@/lib/format";
import { useAuth } from "@/lib/store";
import type { ConversationDetail, User } from "@/lib/types";

/** Derive a message's tick state from other participants' receipt watermarks. */
function messageStatus(
  m: ChatMessage,
  detail: ConversationDetail | null,
  receipts: Record<number, Receipt>,
  meId: number | null,
): MessageStatus {
  if (m.status === "sending") return "sending";
  const others = detail?.participants.filter((p) => p.user.id !== meId) ?? [];
  if (others.length === 0) return "sent";
  if (others.every((p) => (receipts[p.user.id]?.read ?? 0) >= m.id)) return "read";
  if (others.every((p) => (receipts[p.user.id]?.delivered ?? 0) >= m.id)) return "delivered";
  return "sent";
}

export function ChatPane({ onComingSoon }: { onComingSoon: (f: string) => void }) {
  const meId = useAuth((s) => s.user?.id) ?? null;
  const selectedId = useChat((s) => s.selectedId);
  const detail = useChat((s) => s.detail);
  const messages = useChat((s) => s.messages);
  const loading = useChat((s) => s.loadingMessages);
  const wsStatus = useChat((s) => s.wsStatus);
  const presence = useChat((s) => s.presence);
  const typing = useChat((s) => s.typing);
  const otherReceipts = useChat((s) => s.otherReceipts);
  const sendMessage = useChat((s) => s.sendMessage);
  const sendTyping = useChat((s) => s.sendTyping);
  const toggleReaction = useChat((s) => s.toggleReaction);
  const clearSelection = useChat((s) => s.clearSelection);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const typingActive = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usersById = useMemo(() => {
    const m = new Map<number, User>();
    detail?.participants.forEach((p) => m.set(p.user.id, p.user));
    return m;
  }, [detail]);

  // Ids of others currently typing in this conversation.
  const typers = useMemo(
    () =>
      Object.keys(typing[selectedId ?? -1] ?? {})
        .map(Number)
        .filter((id) => id !== meId),
    [typing, selectedId, meId],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [selectedId, messages.length, typers.length]);

  function stopTyping() {
    if (typingActive.current) {
      typingActive.current = false;
      sendTyping(false);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }

  function onDraftChange(value: string) {
    setDraft(value);
    if (value.trim()) {
      if (!typingActive.current) {
        typingActive.current = true;
        sendTyping(true);
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(stopTyping, 2500);
    } else {
      stopTyping();
    }
  }

  function submit() {
    if (!draft.trim()) return;
    sendMessage(draft, replyingTo?.id ?? null);
    setDraft("");
    setReplyingTo(null);
    stopTyping();
  }

  function scrollToMessage(id: number) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-signal", "rounded-2xl");
    setTimeout(() => el.classList.remove("ring-2", "ring-signal", "rounded-2xl"), 1200);
  }

  if (selectedId === null) {
    return (
      <main className="hidden flex-1 flex-col items-center justify-center bg-app md:flex">
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
  const subtitle = renderSubtitle(detail, isGroup, typers, usersById, presence);

  return (
    <main className="flex flex-1 flex-col bg-app">
      {/* Header — group title opens the info/management panel */}
      <header className="flex items-center gap-1 border-b border-border px-2 py-2">
        <button
          onClick={clearSelection}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition hover:bg-hover md:hidden"
        >
          <BackIcon />
        </button>
        <button
          onClick={() => isGroup && setInfoOpen(true)}
          disabled={!isGroup}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1 text-left ${
            isGroup ? "transition hover:bg-hover" : "cursor-default"
          }`}
        >
          {detail && (
            <Avatar
              name={detail.title}
              color={detail.avatar_color ?? "#6b6b6b"}
              url={detail.avatar_url}
              size={38}
              online={
                detail.type === "direct" && detail.other_user
                  ? presence[detail.other_user.id]?.online
                  : undefined
              }
            />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{detail?.title ?? "…"}</p>
            <p className="truncate text-xs text-secondary">{subtitle}</p>
          </div>
        </button>
        <button
          onClick={() => onComingSoon("Calls")}
          aria-label="Video call"
          className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition hover:bg-hover hover:text-primary"
        >
          <VideoIcon />
        </button>
        <button
          onClick={() => onComingSoon("Calls")}
          aria-label="Voice call"
          className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition hover:bg-hover hover:text-primary"
        >
          <PhoneIcon />
        </button>
      </header>

      {infoOpen && isGroup && <GroupInfoModal onClose={() => setInfoOpen(false)} />}

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
              const replyName = m.reply_to?.sender_id
                ? usersById.get(m.reply_to.sender_id)?.display_name
                : undefined;
              return (
                <div key={m.temp_id ?? m.id} id={`msg-${m.id}`}>
                  {showDate && <DateSeparator iso={m.created_at} />}
                  <MessageBubble
                    message={m}
                    mine={mine}
                    grouped={grouped}
                    meId={meId}
                    status={messageStatus(m, detail, otherReceipts, meId)}
                    showSender={isGroup && !mine && !grouped}
                    senderName={sender?.display_name}
                    senderColor={sender?.avatar_color}
                    replyName={replyName}
                    onReact={(emoji) => toggleReaction(m.id, emoji)}
                    onReply={() => setReplyingTo(m)}
                    onQuoteClick={() => m.reply_to && scrollToMessage(m.reply_to.id)}
                  />
                </div>
              );
            })}
            {typers.length > 0 && <TypingBubble />}
          </div>
        )}
      </div>

      {/* Composer */}
      <footer className="border-t border-border px-4 py-3">
        {replyingTo && (
          <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2 rounded-lg border-l-2 border-signal bg-hover px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-signal">
                Replying to{" "}
                {replyingTo.sender_id === meId
                  ? "yourself"
                  : usersById.get(replyingTo.sender_id ?? -1)?.display_name ?? "message"}
              </p>
              <p className="truncate text-xs text-secondary">{replyingTo.body}</p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="rounded-md px-1 text-secondary transition hover:text-primary"
            >
              ✕
            </button>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={stopTyping}
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

function renderSubtitle(
  detail: ConversationDetail | null,
  isGroup: boolean,
  typers: number[],
  usersById: Map<number, User>,
  presence: Record<number, { online: boolean; last_seen?: string }>,
): string {
  if (typers.length > 0) {
    if (!isGroup) return "typing…";
    const names = typers.map((id) => usersById.get(id)?.display_name?.split(" ")[0] ?? "Someone");
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return "Several people are typing…";
  }
  if (isGroup) return `${detail?.participants.length ?? 0} members`;
  const other = detail?.other_user;
  if (!other) return "";
  const p = presence[other.id];
  if (p?.online) return "Online";
  const lastSeen = p?.last_seen ?? other.last_seen_at;
  return lastSeen ? formatLastSeen(lastSeen) : `@${other.username}`;
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

function TypingBubble() {
  return (
    <div className="mt-2 flex justify-start">
      <div className="flex gap-1 rounded-2xl bg-bubble-in px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-2 w-2 animate-bounce rounded-full bg-secondary"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Aggregate raw reactions into { emoji, count, mine } chips. */
function aggregateReactions(message: ChatMessage, meId: number | null) {
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const r of message.reactions) {
    const entry = map.get(r.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (r.user_id === meId) entry.mine = true;
    map.set(r.emoji, entry);
  }
  return [...map.entries()].map(([emoji, v]) => ({ emoji, ...v }));
}

function MessageBubble({
  message,
  mine,
  grouped,
  meId,
  status,
  showSender,
  senderName,
  senderColor,
  replyName,
  onReact,
  onReply,
  onQuoteClick,
}: {
  message: ChatMessage;
  mine: boolean;
  grouped: boolean;
  meId: number | null;
  status: MessageStatus;
  showSender: boolean;
  senderName?: string;
  senderColor?: string;
  replyName?: string;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onQuoteClick: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const chips = aggregateReactions(message, meId);

  return (
    <div
      className={`group relative flex items-center gap-1.5 ${
        mine ? "justify-end" : "justify-start"
      } ${grouped ? "mt-0.5" : "mt-2"}`}
      onMouseLeave={() => setPickerOpen(false)}
    >
      {/* Actions (left of own messages) */}
      {mine && (
        <BubbleActions
          open={pickerOpen}
          onToggle={() => setPickerOpen((v) => !v)}
          onPick={(e) => {
            onReact(e);
            setPickerOpen(false);
          }}
          onReply={onReply}
          align="right"
        />
      )}

      <div className="flex max-w-[75%] flex-col">
        <div
          className={`rounded-2xl px-3 py-2 ${
            mine ? "bg-signal text-white" : "bg-bubble-in text-primary"
          }`}
        >
          {showSender && senderName && (
            <p className="mb-0.5 text-xs font-semibold" style={{ color: senderColor }}>
              {senderName}
            </p>
          )}
          {message.reply_to && (
            <button
              onClick={onQuoteClick}
              className={`mb-1 block w-full rounded-md border-l-2 px-2 py-1 text-left text-xs ${
                mine ? "border-white/60 bg-white/15" : "border-signal bg-signal/10"
              }`}
            >
              <span className="block font-semibold">
                {message.reply_to.sender_id === meId ? "You" : replyName ?? "Message"}
              </span>
              <span className="block truncate opacity-80">
                {message.reply_to.type === "system"
                  ? message.reply_to.body
                  : message.reply_to.body || "Attachment"}
              </span>
            </button>
          )}
          <p className="whitespace-pre-wrap wrap-break-word text-sm">{message.body}</p>
          <div
            className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
              mine ? "text-white/70" : "text-secondary"
            }`}
          >
            <span>{formatTime(message.created_at)}</span>
            {mine && <StatusTicks status={status} />}
          </div>
        </div>

        {chips.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
            {chips.map((c) => (
              <button
                key={c.emoji}
                onClick={() => onReact(c.emoji)}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition ${
                  c.mine
                    ? "border-signal bg-signal/15 text-signal"
                    : "border-border bg-elevated text-secondary hover:bg-hover"
                }`}
              >
                <span>{c.emoji}</span>
                <span>{c.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions (right of others' messages) */}
      {!mine && (
        <BubbleActions
          open={pickerOpen}
          onToggle={() => setPickerOpen((v) => !v)}
          onPick={(e) => {
            onReact(e);
            setPickerOpen(false);
          }}
          onReply={onReply}
          align="left"
        />
      )}
    </div>
  );
}

function BubbleActions({
  open,
  onToggle,
  onPick,
  onReply,
  align,
}: {
  open: boolean;
  onToggle: () => void;
  onPick: (emoji: string) => void;
  onReply: () => void;
  align: "left" | "right";
}) {
  return (
    <div className="relative flex items-center gap-0.5 self-center">
      <button
        onClick={onReply}
        aria-label="Reply"
        className="flex h-7 w-7 items-center justify-center rounded-full text-secondary opacity-0 transition hover:bg-hover hover:text-primary group-hover:opacity-100"
      >
        <ReplyIcon />
      </button>
      <button
        onClick={onToggle}
        aria-label="React"
        className="flex h-7 w-7 items-center justify-center rounded-full text-secondary opacity-0 transition hover:bg-hover hover:text-primary group-hover:opacity-100"
      >
        <SmileIcon />
      </button>
      {open && (
        <div
          className={`absolute bottom-9 z-20 flex gap-1 rounded-full border border-border bg-elevated px-2 py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onPick(e)}
              className="rounded-full px-1 text-lg transition hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SmileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17l-5-5 5-5" />
      <path d="M4 12h11a5 5 0 0 1 5 5v1" />
    </svg>
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

const headerIcon = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BackIcon() {
  return (
    <svg {...headerIcon}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg {...headerIcon}>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg {...headerIcon}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}
