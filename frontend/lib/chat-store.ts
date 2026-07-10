/**
 * Chat store (Zustand).
 *
 * Holds the conversation list, the currently selected conversation with its
 * detail + message history, and the actions to load them. Selecting a
 * conversation loads its history and advances the read watermark (clearing the
 * unread badge). Real-time message arrival is layered on in a later phase.
 */
import { create } from "zustand";

import { api } from "./api";
import type { Conversation, ConversationDetail, Message } from "./types";

interface ChatState {
  conversations: Conversation[];
  selectedId: number | null;
  detail: ConversationDetail | null;
  messages: Message[];
  loadingList: boolean;
  loadingMessages: boolean;

  fetchConversations: () => Promise<void>;
  select: (id: number) => Promise<void>;
  startDirect: (userId: number) => Promise<void>;
  reset: () => void;
}

export const useChat = create<ChatState>((set, get) => ({
  conversations: [],
  selectedId: null,
  detail: null,
  messages: [],
  loadingList: false,
  loadingMessages: false,

  fetchConversations: async () => {
    set({ loadingList: true });
    try {
      const conversations = await api.listConversations();
      set({ conversations });
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
      // Guard against races if the user clicked another conversation meanwhile.
      if (get().selectedId !== id) return;
      set({ detail, messages });

      // Advance the read watermark and clear the local unread badge.
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
    set((s) => {
      const exists = s.conversations.some((c) => c.id === conv.id);
      return {
        conversations: exists
          ? s.conversations
          : [conv, ...s.conversations],
      };
    });
    await get().select(conv.id);
  },

  reset: () =>
    set({
      conversations: [],
      selectedId: null,
      detail: null,
      messages: [],
    }),
}));
