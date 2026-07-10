"use client";

/**
 * "New chat" modal with two modes:
 *   - Message: search the directory and open a 1:1 conversation
 *   - Group:   pick multiple members + a name, then create a group
 */
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { useChat } from "@/lib/chat-store";
import type { User } from "@/lib/types";

type Mode = "direct" | "group";

export function ComposeModal({ onClose }: { onClose: () => void }) {
  const startDirect = useChat((s) => s.startDirect);
  const startGroup = useChat((s) => s.startGroup);

  const [mode, setMode] = useState<Mode>("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<Map<number, User>>(new Map());
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setResults(await api.searchUsers(query));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  async function pickDirect(user: User) {
    setBusy(true);
    try {
      await startDirect(user.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function toggleMember(user: User) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) next.delete(user.id);
      else next.set(user.id, user);
      return next;
    });
  }

  async function createGroup() {
    if (!groupName.trim() || selected.size === 0) return;
    setBusy(true);
    try {
      await startGroup(groupName.trim(), [...selected.keys()]);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="New chat">
      {/* Mode tabs */}
      <div className="flex gap-1 px-3 pt-3">
        {(["direct", "group"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
              mode === m ? "bg-signal text-white" : "bg-hover text-secondary"
            }`}
          >
            {m === "direct" ? "Message" : "Group"}
          </button>
        ))}
      </div>

      {mode === "group" && (
        <div className="px-3 pt-3">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            maxLength={128}
            className="w-full rounded-lg border border-border bg-app px-3 py-2 text-sm outline-none focus:border-signal"
          />
          {selected.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...selected.values()].map((u) => (
                <span
                  key={u.id}
                  className="flex items-center gap-1 rounded-full bg-signal/15 px-2 py-0.5 text-xs text-signal"
                >
                  {u.display_name}
                  <button onClick={() => toggleMember(u)} aria-label={`Remove ${u.display_name}`}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or @username"
          className="w-full rounded-lg border border-border bg-app px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>

      <div className="max-h-72 overflow-y-auto px-1 pb-2">
        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-secondary">No users found.</p>
        ) : (
          results.map((u) => {
            const checked = selected.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => (mode === "direct" ? pickDirect(u) : toggleMember(u))}
                disabled={busy}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-hover disabled:opacity-60"
              >
                <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.display_name}</p>
                  <p className="truncate text-xs text-secondary">@{u.username}</p>
                </div>
                {mode === "group" && (
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                      checked ? "border-signal bg-signal text-white" : "border-border"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {mode === "group" && (
        <div className="border-t border-border p-3">
          <button
            onClick={createGroup}
            disabled={busy || !groupName.trim() || selected.size === 0}
            className="w-full rounded-full bg-signal py-2 text-sm font-medium text-white transition hover:bg-signal-hover disabled:opacity-40"
          >
            Create group{selected.size > 0 ? ` · ${selected.size}` : ""}
          </button>
        </div>
      )}
    </Modal>
  );
}
