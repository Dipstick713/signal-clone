"use client";

/**
 * Group info & management modal.
 *
 * Shows the member list with roles and, for admins, controls to rename the
 * group, add members, and remove members. Everyone can leave the group.
 * Membership changes broadcast system messages, so open panels refresh via the
 * store; here we also optimistically apply the API's returned detail.
 */
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { useChat } from "@/lib/chat-store";
import { useAuth } from "@/lib/store";
import type { User } from "@/lib/types";

export function GroupInfoModal({ onClose }: { onClose: () => void }) {
  const meId = useAuth((s) => s.user?.id) ?? null;
  const detail = useChat((s) => s.detail);
  const presence = useChat((s) => s.presence);
  const refreshDetail = useChat((s) => s.refreshDetail);

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(detail?.title ?? "");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!detail || detail.type !== "group") return null;
  const conversationId = detail.id;
  const isAdmin =
    detail.participants.find((p) => p.user.id === meId)?.role === "admin";

  async function rename() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.renameGroup(conversationId, name.trim());
      await refreshDetail();
      setRenaming(false);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: number) {
    setBusy(true);
    try {
      await api.removeMember(conversationId, userId);
      await refreshDetail();
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (meId === null) return;
    setBusy(true);
    try {
      await api.removeMember(conversationId, meId);
      onClose(); // the conversation.removed event clears it from the store
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Group info" onClose={onClose}>
      {/* Group identity */}
      <div className="flex flex-col items-center gap-2 border-b border-border px-4 py-5">
        <Avatar name={detail.title} color={detail.avatar_color ?? "#6b6b6b"} size={72} />
        {renaming ? (
          <div className="flex w-full max-w-xs items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-app px-3 py-1.5 text-sm outline-none focus:border-signal"
            />
            <button
              onClick={rename}
              disabled={busy}
              className="rounded-lg bg-signal px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{detail.title}</h3>
            {isAdmin && (
              <button
                onClick={() => {
                  setName(detail.title);
                  setRenaming(true);
                }}
                aria-label="Rename group"
                className="text-secondary transition hover:text-primary"
              >
                ✏️
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-secondary">{detail.participants.length} members</p>
      </div>

      {/* Members */}
      <div className="max-h-72 overflow-y-auto px-1 py-2">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs font-medium uppercase tracking-wide text-secondary">
            Members
          </span>
          {isAdmin && (
            <button
              onClick={() => setAdding((v) => !v)}
              className="text-xs font-medium text-signal transition hover:underline"
            >
              {adding ? "Done" : "+ Add"}
            </button>
          )}
        </div>

        {adding && (
          <AddMembers
            conversationId={conversationId}
            existingIds={new Set(detail.participants.map((p) => p.user.id))}
            onChanged={refreshDetail}
          />
        )}

        {detail.participants.map((p) => (
          <div key={p.user.id} className="flex items-center gap-3 px-3 py-2">
            <Avatar
              name={p.user.display_name}
              color={p.user.avatar_color}
              url={p.user.avatar_url}
              size={38}
              online={presence[p.user.id]?.online}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {p.user.display_name}
                {p.user.id === meId && <span className="text-secondary"> (You)</span>}
              </p>
              <p className="truncate text-xs text-secondary">@{p.user.username}</p>
            </div>
            {p.role === "admin" && (
              <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-secondary">
                Admin
              </span>
            )}
            {isAdmin && p.user.id !== meId && (
              <button
                onClick={() => removeMember(p.user.id)}
                disabled={busy}
                aria-label={`Remove ${p.user.display_name}`}
                className="rounded-md px-1.5 text-secondary transition hover:text-rose-500 disabled:opacity-50"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Leave */}
      <div className="border-t border-border p-3">
        <button
          onClick={leave}
          disabled={busy}
          className="w-full rounded-full py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-50"
        >
          Leave group
        </button>
      </div>
    </Modal>
  );
}

/** Inline user search to add members (admin only). */
function AddMembers({
  conversationId,
  existingIds,
  onChanged,
}: {
  conversationId: number;
  existingIds: Set<number>;
  onChanged: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const users = await api.searchUsers(query);
      setResults(users.filter((u) => !existingIds.has(u.id)));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, existingIds]);

  async function add(user: User) {
    setBusyId(user.id);
    try {
      await api.addMembers(conversationId, [user.id]);
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mb-2 rounded-lg bg-hover/50 p-2">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people to add"
        className="mb-1 w-full rounded-lg border border-border bg-app px-3 py-1.5 text-sm outline-none focus:border-signal"
      />
      <div className="max-h-40 overflow-y-auto">
        {results.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-secondary">No one to add.</p>
        ) : (
          results.map((u) => (
            <button
              key={u.id}
              onClick={() => add(u)}
              disabled={busyId !== null}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-hover disabled:opacity-60"
            >
              <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm">{u.display_name}</span>
              <span className="text-xs text-signal">Add</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
