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

export interface PresenceInfo {
  online: boolean;
  last_seen?: string;
}

/** Other participants' receipt watermarks for the *selected* conversation. */
export interface Receipt {
  delivered: number;
  read: number;
}

interface ChatState {
  conversations: Conversation[];
  selectedId: number | null;
  detail: ConversationDetail | null;
  messages: ChatMessage[];
  loadingList: boolean;
  loadingMessages: boolean;
  wsStatus: WsStatus;
  // user id -> presence
  presence: Record<number, PresenceInfo>;
  // conversation id -> (user id -> expiresAt ms) of who is currently typing
  typing: Record<number, Record<number, number>>;
  // for the selected conversation: other user id -> receipt watermarks
  otherReceipts: Record<number, Receipt>;

  connect: (token: string) => void;
  disconnect: () => void;
  fetchConversations: () => Promise<void>;
  select: (id: number) => Promise<void>;
  startDirect: (userId: number) => Promise<void>;
  startGroup: (name: string, memberIds: number[]) => Promise<number>;
  sendMessage: (body: string) => void;
  sendTyping: (isTyping: boolean) => void;
  refreshDetail: () => Promise<void>;
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
  presence: {},
  typing: {},
  otherReceipts: {},

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

      // Seed receipt watermarks for the other participants from the detail.
      const meId = useAuth.getState().user?.id ?? null;
      const otherReceipts: Record<number, Receipt> = {};
      detail.participants.forEach((p) => {
        if (p.user.id !== meId) {
          otherReceipts[p.user.id] = {
            delivered: p.last_delivered_message_id ?? 0,
            read: p.last_read_message_id ?? 0,
          };
        }
      });
      set({ detail, messages, otherReceipts });

      const last = messages[messages.length - 1];
      if (last) {
        void api.markRead(id, last.id);
        // Opening a thread both delivers and reads up to the latest message.
        realtime.send({ type: "receipt.delivered", conversation_id: id, message_id: last.id });
        realtime.send({ type: "receipt.read", conversation_id: id, message_id: last.id });
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

  startGroup: async (name, memberIds) => {
    const conv = await api.createGroup(name, memberIds);
    set((s) => ({ conversations: [conv, ...s.conversations] }));
    await get().select(conv.id);
    return conv.id;
  },

  refreshDetail: async () => {
    const id = get().selectedId;
    if (id === null) return;
    const detail = await api.getConversation(id);
    if (get().selectedId === id) set({ detail });
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

  sendTyping: (isTyping) => {
    const conversationId = get().selectedId;
    if (conversationId === null) return;
    realtime.send({
      type: isTyping ? "typing.start" : "typing.stop",
      conversation_id: conversationId,
    });
  },

  reset: () =>
    set({
      conversations: [],
      selectedId: null,
      detail: null,
      messages: [],
      presence: {},
      typing: {},
      otherReceipts: {},
    }),
}));

const TYPING_TTL_MS = 6000;

type SetState = (
  partial: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>),
) => void;

/** Handle an inbound realtime event. */
function handleEvent(event: WsEvent, set: SetState, get: () => ChatState) {
  switch (event.type) {
    case "message.new":
      return handleMessageNew(event, set, get);
    case "receipt.update":
      return handleReceiptUpdate(event, set, get);
    case "typing.update":
      return handleTypingUpdate(event, set, get);
    case "presence.update":
      return handlePresenceUpdate(event, set);
    case "presence.snapshot":
      return handlePresenceSnapshot(event, set);
    case "conversation.removed":
      return handleConversationRemoved(event, set, get);
  }
}

function handleMessageNew(event: WsEvent, set: SetState, get: () => ChatState) {
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

  const known = state.conversations.some((c) => c.id === msg.conversation_id);
  if (!known) void get().fetchConversations();

  // A system message (membership/name change) may have altered the member list.
  if (msg.type === "system" && isSelected) void get().refreshDetail();

  // Report delivery for any received message; add read if we're viewing it.
  if (!isMine) {
    realtime.send({
      type: "receipt.delivered",
      conversation_id: msg.conversation_id,
      message_id: msg.id,
    });
    if (isSelected) {
      void api.markRead(msg.conversation_id, msg.id);
      realtime.send({
        type: "receipt.read",
        conversation_id: msg.conversation_id,
        message_id: msg.id,
      });
    }
  }
}

function handleReceiptUpdate(event: WsEvent, set: SetState, get: () => ChatState) {
  const conversationId = event.conversation_id as number;
  const userId = event.user_id as number;
  const kind = event.kind as "delivered" | "read";
  const messageId = event.message_id as number;
  const meId = useAuth.getState().user?.id ?? null;

  // Receipts only affect the tick state of the currently open conversation.
  if (userId === meId || conversationId !== get().selectedId) return;

  set((s) => {
    const current = s.otherReceipts[userId] ?? { delivered: 0, read: 0 };
    const next = { ...current };
    if (kind === "delivered") next.delivered = Math.max(next.delivered, messageId);
    else next.read = Math.max(next.read, messageId);
    return { otherReceipts: { ...s.otherReceipts, [userId]: next } };
  });
}

function handleTypingUpdate(event: WsEvent, set: SetState, get: () => ChatState) {
  const conversationId = event.conversation_id as number;
  const userId = event.user_id as number;
  const isTyping = event.is_typing as boolean;

  set((s) => {
    const forConv = { ...(s.typing[conversationId] ?? {}) };
    if (isTyping) forConv[userId] = Date.now() + TYPING_TTL_MS;
    else delete forConv[userId];
    return { typing: { ...s.typing, [conversationId]: forConv } };
  });

  // Auto-expire the indicator if no stop/refresh arrives.
  if (isTyping) {
    setTimeout(() => {
      set((s) => {
        const forConv = s.typing[conversationId];
        if (!forConv || (forConv[userId] ?? 0) > Date.now()) return {};
        const copy = { ...forConv };
        delete copy[userId];
        return { typing: { ...s.typing, [conversationId]: copy } };
      });
    }, TYPING_TTL_MS + 100);
  }
}

function handlePresenceUpdate(event: WsEvent, set: SetState) {
  const userId = event.user_id as number;
  set((s) => ({
    presence: {
      ...s.presence,
      [userId]: {
        online: event.is_online as boolean,
        last_seen: event.last_seen as string | undefined,
      },
    },
  }));
}

function handlePresenceSnapshot(event: WsEvent, set: SetState) {
  const ids = (event.user_ids as number[]) ?? [];
  set((s) => {
    const presence = { ...s.presence };
    ids.forEach((id) => (presence[id] = { online: true }));
    return { presence };
  });
}

function handleConversationRemoved(event: WsEvent, set: SetState, get: () => ChatState) {
  const conversationId = event.conversation_id as number;
  const wasSelected = get().selectedId === conversationId;
  set((s) => ({
    conversations: s.conversations.filter((c) => c.id !== conversationId),
    ...(wasSelected
      ? { selectedId: null, detail: null, messages: [], otherReceipts: {} }
      : {}),
  }));
}
