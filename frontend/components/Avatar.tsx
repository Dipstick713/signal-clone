/**
 * Coloured-initials avatar, matching Signal's default profile look.
 * Falls back to initials over `color` when no image URL is present.
 */
interface AvatarProps {
  name: string;
  color: string;
  url?: string | null;
  size?: number;
  /** Show a green presence dot in the corner when true. */
  online?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

export function Avatar({ name, color, url, size = 40, online }: AvatarProps) {
  const dotSize = Math.max(8, Math.round(size * 0.28));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-medium text-white select-none"
          style={{ backgroundColor: color, fontSize: size * 0.4 }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-panel bg-green-500"
          style={{ width: dotSize, height: dotSize }}
          aria-label="online"
        />
      )}
    </div>
  );
}
