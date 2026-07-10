/**
 * Theme store: light / dark / system.
 *
 * The effective theme toggles a `.dark` class on <html> (see globals.css tokens).
 * A blocking inline script in the root layout applies the stored choice before
 * paint to avoid a flash; this store keeps it in sync at runtime and reacts to
 * OS changes while in "system" mode.
 */
import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "signal-theme";

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  init: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "system",

  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },

  init: () => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
    applyTheme(stored);
    set({ theme: stored });
    // Re-apply on OS theme changes while following the system preference.
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (get().theme === "system") applyTheme("system");
      });
  },
}));
