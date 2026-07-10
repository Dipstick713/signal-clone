"use client";

/** Placeholder modal for not-yet-built features (Calls, Stories, etc.). */
import { Modal } from "@/components/Modal";

const BLURBS: Record<string, string> = {
  Calls: "Voice and video calls are on the roadmap.",
  Stories: "Share disappearing photo and video updates — coming soon.",
  "Linked devices": "Use Signal on your desktop and tablet at the same time.",
};

export function ComingSoonModal({
  feature,
  onClose,
}: {
  feature: string;
  onClose: () => void;
}) {
  return (
    <Modal title={feature} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-signal/15 text-3xl">
          🚧
        </div>
        <h3 className="text-lg font-semibold">Coming soon</h3>
        <p className="max-w-xs text-sm text-secondary">
          {BLURBS[feature] ?? `${feature} isn't available yet.`}
        </p>
      </div>
    </Modal>
  );
}
