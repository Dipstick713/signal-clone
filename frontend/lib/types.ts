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

export interface Reaction {
  emoji: string;
  user_id: number;
}

export interface MessagePreview {
  id: number;
  sender_id: number | null;
  body: string;
  type: "text" | "system";
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  body: string;
  type: "text" | "system";
  reply_to_id: number | null;
  reply_to: MessagePreview | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reactions: Reaction[];
}

export type ConversationType = "direct" | "group";

export interface Conversation {
  id: number;
  type: ConversationType;
  title: string;
  avatar_color: string | null;
  avatar_url: string | null;
  updated_at: string;
  unread_count: number;
  last_message: Message | null;
  other_user: User | null;
}

export interface ParticipantPublic {
  user: User;
  role: "admin" | "member";
  last_read_message_id: number | null;
  last_delivered_message_id: number | null;
}

export interface ConversationDetail {
  id: number;
  type: ConversationType;
  title: string;
  avatar_color: string | null;
  avatar_url: string | null;
  created_by: number | null;
  participants: ParticipantPublic[];
  other_user: User | null;
}
