"use client";

/**
 * Settings modal: edit profile (name, avatar colour, about), choose the theme,
 * and view privacy/notification placeholders. Privacy/notification switches are
 * cosmetic for this demo; profile edits persist via PATCH /users/me.
 */
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { useChat } from "@/lib/chat-store";
import { AVATAR_COLORS } from "@/lib/constants";
import { useAuth } from "@/lib/store";
import { useTheme, type Theme } from "@/lib/theme";
import { toast } from "@/lib/toast";

export function SettingsModal({
  onClose,
  onComingSoon,
}: {
  onClose: () => void;
  onComingSoon: (feature: string) => void;
}) {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const authLogout = useAuth((s) => s.logout);
  const disconnect = useChat((s) => s.disconnect);
  const reset = useChat((s) => s.reset);
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [about, setAbout] = useState(user?.about ?? "");
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color ?? AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const dirty =
    !!user &&
    (displayName.trim() !== user.display_name ||
      about !== user.about ||
      avatarColor !== user.avatar_color);

  async function save() {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateMe({
        display_name: displayName.trim(),
        about,
        avatar_color: avatarColor,
      });
      setUser(updated);
      toast.show({ title: "Profile updated", color: updated.avatar_color });
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    disconnect();
    reset();
    authLogout();
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="max-h-[70vh] overflow-y-auto">
        {/* Profile */}
        <Section title="Profile">
          <div className="flex flex-col items-center gap-3">
            <Avatar name={displayName || "?"} color={avatarColor} size={72} />
            <div className="flex flex-wrap justify-center gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  aria-label={`Colour ${c}`}
                  className={`h-6 w-6 rounded-full transition ${
                    avatarColor === c ? "ring-2 ring-signal ring-offset-2 ring-offset-elevated" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Field label="Display name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={64}
              className="w-full rounded-lg border border-border bg-app px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </Field>
          <Field label="About">
            <input
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={256}
              placeholder="Add a few words about yourself"
              className="w-full rounded-lg border border-border bg-app px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </Field>
          <p className="text-xs text-secondary">@{user?.username}</p>
          <button
            onClick={save}
            disabled={!dirty || saving || !displayName.trim()}
            className="w-full rounded-full bg-signal py-2 text-sm font-medium text-white transition hover:bg-signal-hover disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <div className="flex gap-1 rounded-lg bg-hover p-1">
            {(["light", "dark", "system"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-md py-1.5 text-sm capitalize transition ${
                  theme === t ? "bg-elevated font-medium shadow-sm" : "text-secondary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Section>

        {/* Privacy (placeholder) */}
        <Section title="Privacy">
          <Toggle label="Read receipts" defaultOn />
          <Toggle label="Typing indicators" defaultOn />
          <p className="text-xs text-secondary">Placeholder settings for this demo.</p>
        </Section>

        {/* Notifications (placeholder) */}
        <Section title="Notifications">
          <Toggle label="Message notifications" defaultOn />
          <Toggle label="Show message preview" defaultOn />
        </Section>

        {/* Other */}
        <Section title="Advanced">
          <PlaceholderRow
            label="Linked devices"
            onClick={() => onComingSoon("Linked devices")}
          />
          <PlaceholderRow label="Calls" onClick={() => onComingSoon("Calls")} />
          <PlaceholderRow label="Stories" onClick={() => onComingSoon("Stories")} />
        </Section>

        <div className="border-t border-border p-4">
          <button
            onClick={logout}
            className="w-full rounded-full py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-500/10"
          >
            Log out
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="flex items-center justify-between"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative h-6 w-10 rounded-full transition ${on ? "bg-signal" : "bg-hover"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function PlaceholderRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-lg px-1 py-1.5 text-left transition hover:bg-hover"
    >
      <span className="text-sm">{label}</span>
      <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-secondary">
        Coming soon
      </span>
    </button>
  );
}
