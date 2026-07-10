/** Shared API types, mirroring the backend Pydantic schemas. */

export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
  about: string;
  last_seen_at: string;
}

export interface AuthStartResponse {
  username: string;
  is_new_user: boolean;
  otp_hint: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
