/**
 * Thin typed fetch wrapper around the FastAPI backend.
 *
 * Reads the base URL from NEXT_PUBLIC_API_URL and injects the Bearer token
 * from the auth store on every request. Non-2xx responses throw `ApiError`
 * carrying the backend's `detail` message so the UI can surface it.
 */
import type { AuthResponse, AuthStartResponse, User } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Set by the auth store so requests can attach the current token.
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  authStart: (username: string) =>
    request<AuthStartResponse>("/api/auth/start", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),

  authVerify: (payload: {
    username: string;
    otp: string;
    display_name?: string;
    avatar_color?: string;
  }) =>
    request<AuthResponse>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMe: () => request<User>("/api/auth/me"),

  updateMe: (payload: Partial<Pick<User, "display_name" | "avatar_color" | "avatar_url" | "about">>) =>
    request<User>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
