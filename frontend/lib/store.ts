/**
 * Auth store (Zustand).
 *
 * Persists the JWT + user to localStorage so a session survives reloads.
 * On app load, `hydrate()` re-attaches the token and revalidates it against
 * the backend (`/auth/me`); an invalid/expired token logs the user out.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { api, setAuthToken } from "./api";
import type { User } from "./types";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  token: string | null;
  user: User | null;
  status: Status;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      status: "loading",

      setSession: (token, user) => {
        setAuthToken(token);
        set({ token, user, status: "authenticated" });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        setAuthToken(null);
        set({ token: null, user: null, status: "unauthenticated" });
      },

      hydrate: async () => {
        const { token } = get();
        if (!token) {
          set({ status: "unauthenticated" });
          return;
        }
        setAuthToken(token);
        try {
          const user = await api.getMe();
          set({ user, status: "authenticated" });
        } catch {
          setAuthToken(null);
          set({ token: null, user: null, status: "unauthenticated" });
        }
      },
    }),
    {
      name: "signal-clone-auth",
      // Only persist credentials; status is always recomputed on load.
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
