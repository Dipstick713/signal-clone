/**
 * Lightweight toast store. `toast.show(...)` can be called from anywhere
 * (including non-React modules like the chat store); the <Toaster> renders them.
 */
import { create } from "zustand";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  color?: string; // avatar/accent colour for the toast dot
  onClick?: () => void;
}

interface ToastState {
  toasts: Toast[];
  show: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
      4000,
    );
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Imperative helper usable outside React. */
export const toast = {
  show: (t: Omit<Toast, "id">) => useToasts.getState().show(t),
};
