"use client";

/**
 * Main app view (protected by SessionProvider): the Signal two-pane layout
 * wiring the conversation list rail and the chat pane, plus the "new chat"
 * compose modal. Loads the conversation list on mount.
 */
import { useEffect, useState } from "react";

import { ChatPane } from "@/components/chat/ChatPane";
import { ComposeModal } from "@/components/chat/ComposeModal";
import { ConversationList } from "@/components/chat/ConversationList";
import { useChat } from "@/lib/chat-store";
import { useAuth } from "@/lib/store";

export default function Home() {
  const userId = useAuth((s) => s.user?.id);
  const fetchConversations = useChat((s) => s.fetchConversations);
  const reset = useChat((s) => s.reset);
  const [composeOpen, setComposeOpen] = useState(false);

  // (Re)load the conversation list whenever the signed-in user changes.
  useEffect(() => {
    if (userId === undefined) return;
    reset();
    void fetchConversations();
  }, [userId, fetchConversations, reset]);

  return (
    <div className="flex h-full">
      <ConversationList onCompose={() => setComposeOpen(true)} />
      <ChatPane />
      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
    </div>
  );
}
