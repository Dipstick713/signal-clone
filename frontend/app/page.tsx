"use client";

/**
 * Main app view (protected by SessionProvider): Signal's multi-pane layout —
 * icon nav rail, conversation list, and chat pane — plus the compose, settings,
 * and "coming soon" modals and the toast container. Loads conversations and
 * opens the realtime socket on mount.
 */
import { useEffect, useState } from "react";

import { ChatPane } from "@/components/chat/ChatPane";
import { ComposeModal } from "@/components/chat/ComposeModal";
import { ConversationList } from "@/components/chat/ConversationList";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import { NavRail } from "@/components/NavRail";
import { SettingsModal } from "@/components/SettingsModal";
import { Toaster } from "@/components/Toaster";
import { useChat } from "@/lib/chat-store";
import { useAuth } from "@/lib/store";

export default function Home() {
  const userId = useAuth((s) => s.user?.id);
  const token = useAuth((s) => s.token);
  const fetchConversations = useChat((s) => s.fetchConversations);
  const connect = useChat((s) => s.connect);
  const reset = useChat((s) => s.reset);

  const [composeOpen, setComposeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  // (Re)load the list and open the socket whenever the signed-in user changes.
  useEffect(() => {
    if (userId === undefined || !token) return;
    reset();
    void fetchConversations();
    connect(token);
  }, [userId, token, fetchConversations, connect, reset]);

  // Keyboard shortcut: Cmd/Ctrl+K opens the new-chat modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setComposeOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full">
      <NavRail
        onSettings={() => setSettingsOpen(true)}
        onComingSoon={(f) => setComingSoon(f)}
      />
      <ConversationList
        onCompose={() => setComposeOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />
      <ChatPane onComingSoon={(f) => setComingSoon(f)} />

      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onComingSoon={(f) => setComingSoon(f)}
        />
      )}
      {comingSoon && (
        <ComingSoonModal feature={comingSoon} onClose={() => setComingSoon(null)} />
      )}
      <Toaster />
    </div>
  );
}
