"use client";

/**
 * Main app shell (protected by SessionProvider).
 *
 * Phase 2 shows the authenticated user in the rail header with a logout
 * control; the conversation list and chat pane are filled in later phases.
 */
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/store";

export default function Home() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <div className="flex h-full">
      {/* Left rail: conversation list */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-panel">
        <header className="flex items-center gap-3 px-4 py-3">
          {user && (
            <Avatar
              name={user.display_name}
              color={user.avatar_color}
              url={user.avatar_url}
              size={36}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {user?.display_name}
            </p>
            <p className="truncate text-xs text-secondary">@{user?.username}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md px-2 py-1 text-xs text-secondary transition hover:bg-hover hover:text-primary"
          >
            Log out
          </button>
        </header>
        <div className="px-4 pb-3">
          <div className="rounded-full bg-hover px-4 py-2 text-sm text-secondary">
            Search
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-secondary">
          No conversations yet.
        </div>
      </aside>

      {/* Right pane: chat / empty state */}
      <main className="flex flex-1 flex-col items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-signal text-2xl text-on-accent">
            💬
          </div>
          <h2 className="text-xl font-semibold">
            Welcome, {user?.display_name?.split(" ")[0]}
          </h2>
          <p className="max-w-xs text-sm text-secondary">
            Select a conversation to start messaging. End-to-end encryption is
            simulated for this demo.
          </p>
        </div>
      </main>
    </div>
  );
}
