"use client";

/** Fixed toast container (top-right). Renders active toasts from the store. */
import { useToasts } from "@/lib/toast";

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            t.onClick?.();
            dismiss(t.id);
          }}
          className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-elevated px-4 py-3 text-left shadow-lg transition hover:bg-hover"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: t.color ?? "#2c6bed" }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t.title}</p>
            {t.body && <p className="truncate text-sm text-secondary">{t.body}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}
