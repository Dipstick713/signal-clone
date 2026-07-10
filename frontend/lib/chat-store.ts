/**
 * Chat store (Zustand).
 *
 * Holds the conversation list, the selected conversation with its detail +
 * message history, the realtime connection status, and all messaging actions.
 *
 * Realtime: `connect()` opens the WebSocket and subscribes to inbound events.
 * Sending is optimistic — a temporary bubble (status "sending") is appended
 * immediately and reconciled to the persisted message (status "sent") when the
 * server echoes it back with the matching `temp_id`. Inbound messages for other
 * conversations update the list's preview/unread and re-sort by recency.
 */
import { create } from "zustand";

import { api } from "./api";
import { useAuth } from "./store";
import type { Conversation, ConversationDetail, Message } from "./types";
import { realtime, type WsEvent, type WsStatus } from "./ws";

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

/** A message plus client-only fields for optimistic rendering. */
export type ChatMessage = Message & {
  status?: MessageStatus;
  temp_id?: string;
};

interface ChatState {
  conversations: Conversation[];
  selectedId: number | null;
  detail: ConversationDetail | null;
  messages: ChatMessage[];
  loadingList: boolean;
  loadingMessages: boolean;
  wsStatus: WsStatus;

  connect: (token: string) => void;
  disconnect: () => void;
  fetchConversations: () => Promise<void>;
  select: (id: number) => Promise<void>;
  startDirect: (userId: number) => Promise<void>;
  sendMessage: (body: string) => void;
  reset: () => void;
}

let subscribed = false;

/** Move the conversation with the incoming message to the front, updating its
 *  preview/unread. Returns a new, recency-sorted array. */
function applyToList(
  conversations: Conversation[],
  msg: Message,
  opts: { isSelected: boolean; isMine: boolean },
): { list: Conversation[]; known: boolean } {
  const idx = conversations.findIndex((c) => c.id === msg.conversation_id);
  if (idx === -1) return { list: conversations, known: false };

  const current = conversations[idx];
  const updated: Conversation = {
    ...current,
    last_message: msg,
    updated_at: msg.created_at,
    unread_count:
      opts.isSelected || opts.isMine
        ? current.unread_count
        : current.unread_count + 1,
  };
  const rest = conversations.filter((_, i) => i !== idx);
  return { list: [updated, ...rest], known: true };
}

export const useChat = create<ChatState>((set, get) => ({
  conversations: [],
  selectedId: null,
  detail: null,
  messages: [],
  loadingList: false,
  loadingMessages: false,
  wsStatus: "closed",

  connect: (token) => {
    if (!subscribed) {
      subscribed = true;
      realtime.onStatus((wsStatus) => set({ wsStatus }));
      realtime.onEvent((event) => handleEvent(event, set, get));
    }
    realtime.connect(token);
  },

  disconnect: () => realtime.disconnect(),

  fetchConversations: async () => {
    set({ loadingList: true });
    try {
      set({ conversations: await api.listConversations() });
    } finally {
      set({ loadingList: false });
    }
  },

  select: async (id) => {
    set({ selectedId: id, detail: null, messages: [], loadingMessages: true });
    try {
      const [detail, messages] = await Promise.all([
        api.getConversation(id),
        api.getMessages(id),
      ]);
      if (get().selectedId !== id) return; // superseded by another click
      set({ detail, messages });

      const last = messages[messages.length - 1];
      if (last) {
        void api.markRead(id, last.id);
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, unread_count: 0 } : c,
          ),
        }));
      }
    } finally {
      if (get().selectedId === id) set({ loadingMessages: false });
    }
  },

  startDirect: async (userId) => {
    const conv = await api.createDirect(userId);
    set((s) => ({
      conversations: s.conversations.some((c) => c.id === conv.id)
        ? s.conversations
        : [conv, ...s.conversations],
    }));
    await get().select(conv.id);
  },

  sendMessage: (body) => {
    const text = body.trim();
    const conversationId = get().selectedId;
    if (!text || conversationId === null) return;

    const meId = useAuth.getState().user?.id ?? null;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessage = {
      id: -Date.now(), // temporary negative id, replaced on echo
      conversation_id: conversationId,
      sender_id: meId,
      body: text,
      type: "text",
      reply_to_id: null,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      status: "sending",
      temp_id: tempId,
    };

    set((s) => ({
      messages: [...s.messages, optimistic],
      conversations: applyToList(s.conversations, optimistic, {
        isSelected: true,
        isMine: true,
      }).list,
    }));

    realtime.send({
      type: "message.send",
      conversation_id: conversationId,
      body: text,
      temp_id: tempId,
    });
  },

  reset: () =>
    set({ conversations: [], selectedId: null, detail: null, messages: [] }),
}));

/** Handle an inbound realtime event. */
function handleEvent(
  event: WsEvent,
  set: (partial: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void,
  get: () => ChatState,
) {
  if (event.type !== "message.new") return;
  const msg = event.message as Message;
  const tempId = (event.temp_id as string | null) ?? null;
  const meId = useAuth.getState().user?.id ?? null;
  const isMine = msg.sender_id === meId;

  const state = get();
  const isSelected = msg.conversation_id === state.selectedId;

  set((s) => {
    let messages = s.messages;
    if (isSelected) {
      const pendingIdx = tempId
        ? messages.findIndex((m) => m.temp_id === tempId)
        : -1;
      if (pendingIdx !== -1) {
        messages = messages.slice();
        messages[pendingIdx] = { ...msg, status: "sent" };
      } else if (!messages.some((m) => m.id === msg.id)) {
        messages = [...messages, { ...msg, status: isMine ? "sent" : undefined }];
      }
    }
    const { list } = applyToList(s.conversations, msg, { isSelected, isMine });
    return { messages, conversations: list };
  });

  // Unknown conversation (e.g. someone messaged us first) — pull the list.
  const known = state.conversations.some((c) => c.id === msg.conversation_id);
  if (!known) void get().fetchConversations();

  // If we're viewing this thread, keep our read watermark current.
  if (isSelected && !isMine) void api.markRead(msg.conversation_id, msg.id);
}
