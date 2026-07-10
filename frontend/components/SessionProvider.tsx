"use client";

/**
 * Hydrates the auth session on first mount (revalidating any persisted token)
 * and enforces route access:
 *   - unauthenticated users are redirected to /welcome
 *   - authenticated users on /welcome are redirected to the app
 * Renders a lightweight splash while the session status is still "loading".
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/store";
import { useTheme } from "@/lib/theme";

const PUBLIC_ROUTES = ["/welcome"];

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const hydrate = useAuth((s) => s.hydrate);
  const router = useRouter();
  const pathname = usePathname();

  const initTheme = useTheme((s) => s.init);

  // Revalidate persisted token and initialise the theme once on mount.
  useEffect(() => {
    void hydrate();
    initTheme();
  }, [hydrate, initTheme]);

  // Redirect based on auth status.
  useEffect(() => {
    if (status === "loading") return;
    const isPublic = PUBLIC_ROUTES.includes(pathname);
    if (status === "unauthenticated" && !isPublic) {
      router.replace("/welcome");
    } else if (status === "authenticated" && isPublic) {
      router.replace("/");
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-app">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-signal border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
