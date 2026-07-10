/**
 * Realtime WebSocket client.
 *
 * A thin singleton around the browser WebSocket that:
 *   - connects to `${API}/ws?token=<jwt>`
 *   - parses inbound JSON events and forwards them to subscribers
 *   - auto-reconnects with capped backoff while a session is active
 *   - reports connection status ("connecting" | "open" | "closed")
 *
 * The chat store owns the wiring (subscribe to events, send on user actions).
 */
export type WsStatus = "connecting" | "open" | "closed";

export interface WsEvent {
  type: string;
  [key: string]: unknown;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
const WS_URL = API_URL.replace(/^http/, "ws") + "/ws";

type EventHandler = (event: WsEvent) => void;
type StatusHandler = (status: WsStatus) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private shouldReconnect = false;
  private reconnectDelay = 1000;
  private eventHandlers = new Set<EventHandler>();
  private statusHandlers = new Set<StatusHandler>();

  connect(token: string) {
    // Reconnect only if the token changed or we have no socket.
    if (this.ws && this.token === token) return;
    this.token = token;
    this.shouldReconnect = true;
    this.open();
  }

  private open() {
    if (!this.token) return;
    this.setStatus("connecting");
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(this.token)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.setStatus("open");
    };
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as WsEvent;
        this.eventHandlers.forEach((h) => h(event));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      this.ws = null;
      this.setStatus("closed");
      if (this.shouldReconnect) {
        setTimeout(() => this.open(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000);
      }
    };
    ws.onerror = () => ws.close();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.token = null;
    this.ws?.close();
    this.ws = null;
  }

  send(payload: object): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private setStatus(status: WsStatus) {
    this.statusHandlers.forEach((h) => h(status));
  }
}

export const realtime = new RealtimeClient();
