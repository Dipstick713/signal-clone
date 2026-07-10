"use client";

/**
 * Slim left icon rail, à la Signal Desktop. "Chats" is the active view; Calls
 * and Stories are placeholders that open a "Coming soon" modal. The gear opens
 * Settings, and the avatar at the bottom opens Settings on the profile section.
 */
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/store";

interface NavRailProps {
  onSettings: () => void;
  onComingSoon: (feature: string) => void;
}

export function NavRail({ onSettings, onComingSoon }: NavRailProps) {
  const user = useAuth((s) => s.user);

  return (
    <nav className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-border bg-panel py-3 md:flex">
      <RailButton label="Chats" active onClick={() => {}}>
        <ChatIcon />
      </RailButton>
      <RailButton label="Calls" onClick={() => onComingSoon("Calls")}>
        <PhoneIcon />
      </RailButton>
      <RailButton label="Stories" onClick={() => onComingSoon("Stories")}>
        <StoriesIcon />
      </RailButton>

      <div className="flex-1" />

      <RailButton label="Settings" onClick={onSettings}>
        <GearIcon />
      </RailButton>
      <button
        onClick={onSettings}
        aria-label="Profile"
        className="mt-1 rounded-full ring-offset-2 ring-offset-panel transition hover:ring-2 hover:ring-signal"
      >
        {user && (
          <Avatar
            name={user.display_name}
            color={user.avatar_color}
            url={user.avatar_url}
            size={36}
          />
        )}
      </button>
    </nav>
  );
}

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
        active
          ? "bg-signal/15 text-signal"
          : "text-secondary hover:bg-hover hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ChatIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg {...iconProps}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}
function StoriesIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 2.5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
