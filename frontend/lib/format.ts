/** Date/time formatting helpers for the chat UI. */

function toDate(iso: string): Date {
  // Backend timestamps are UTC but SQLite drops the tz suffix; treat a bare
  // (offset-less) timestamp as UTC so local rendering is correct.
  const hasTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasTz ? iso : iso + "Z");
}

/** Short time like "3:07 PM". */
export function formatTime(iso: string): string {
  return toDate(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Conversation-list timestamp: time today, "Yesterday", weekday, or date. */
export function formatListTime(iso: string): string {
  const d = toDate(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - d.getTime()) / 86400000);

  if (d >= startOfToday) return formatTime(iso);
  if (diffDays < 1) return "Yesterday";
  if (diffDays < 6) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
}

/** Date-separator label shown between message groups. */
export function formatDateSeparator(iso: string): string {
  const d = toDate(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - d.getTime()) / 86400000);

  if (d >= startOfToday) return "Today";
  if (diffDays < 1) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** True if the two timestamps fall on different calendar days. */
export function isDifferentDay(a: string, b: string): boolean {
  return toDate(a).toDateString() !== toDate(b).toDateString();
}

/** Relative last-seen label, e.g. "last seen just now", "last seen 5m ago". */
export function formatLastSeen(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - toDate(iso).getTime()) / 1000));
  if (secs < 60) return "last seen just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `last seen ${days}d ago`;
  return `last seen ${toDate(iso).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}
