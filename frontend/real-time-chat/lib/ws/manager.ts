import type { ConnectionState, ServerEvent } from "./types";
import { ServerEventSchema } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const WS_BASE =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws")
    : "ws://localhost:3001/ws";

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;
const JITTER_FACTOR = 0.2;
const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
const DEGRADED_THRESHOLD = 5;

// ─── Listener types ───────────────────────────────────────────────────────────

type StateMeta = { attempt: number; nextDelayMs: number | null };
type StateListener = (state: ConnectionState, meta: StateMeta) => void;
type MessageListener = (event: ServerEvent) => void;

// ─── WebSocketManager ─────────────────────────────────────────────────────────

export class WebSocketManager {
  private static _instance: WebSocketManager | null = null;

  private _socket: WebSocket | null = null;
  private _token: string | null = null;
  private _state: ConnectionState = "idle";
  private _attempt = 0;
  private _nextDelayMs: number | null = null;
  private _intentionalClose = false;

  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _pingTimer: ReturnType<typeof setInterval> | null = null;
  private _pongTimer: ReturnType<typeof setTimeout> | null = null;

  private _messageListeners = new Set<MessageListener>();
  private _stateListeners = new Set<StateListener>();

  static getInstance(): WebSocketManager {
    if (!WebSocketManager._instance) {
      WebSocketManager._instance = new WebSocketManager();
    }
    return WebSocketManager._instance;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  connect(token: string): void {
    if (
      this._socket &&
      (this._socket.readyState === WebSocket.OPEN ||
        this._socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this._token = token;
    this._intentionalClose = false;
    this._clearReconnectTimer();
    this._openSocket();
  }

  disconnect(): void {
    this._intentionalClose = true;
    this._attempt = 0;
    this._nextDelayMs = null;
    this._clearReconnectTimer();
    this._stopHeartbeat();
    if (this._socket) {
      this._socket.close(1000, "User disconnected");
      this._socket = null;
    }
    this._setState("idle", { attempt: 0, nextDelayMs: null });
  }

  /**
   * Send a typed client event. Pass only `type` for events with no payload (Ping).
   */
  send(type: string, payload?: unknown): void {
    if (!this._socket || this._socket.readyState !== WebSocket.OPEN) return;
    const frame = payload !== undefined ? { type, payload } : { type };
    this._socket.send(JSON.stringify(frame));
  }

  onMessage(listener: MessageListener): () => void {
    this._messageListeners.add(listener);
    return () => this._messageListeners.delete(listener);
  }

  onStateChange(listener: StateListener): () => void {
    this._stateListeners.add(listener);
    return () => this._stateListeners.delete(listener);
  }

  getState(): ConnectionState {
    return this._state;
  }

  getMeta(): StateMeta {
    return { attempt: this._attempt, nextDelayMs: this._nextDelayMs };
  }

  isReady(): boolean {
    return this._socket?.readyState === WebSocket.OPEN;
  }

  getSocket(): WebSocket | null {
    return this._socket;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _openSocket(): void {
    if (!this._token) return;

    this._setState("connecting", { attempt: this._attempt, nextDelayMs: null });

    const url = `${WS_BASE}?token=${encodeURIComponent(this._token)}`;
    const socket = new WebSocket(url);
    this._socket = socket;

    const handleUnload = (): void => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "unload");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleUnload);
      window.addEventListener("pagehide", handleUnload);
    }

    socket.onopen = (): void => {
      this._attempt = 0;
      this._nextDelayMs = null;
      this._setState("connected", { attempt: 0, nextDelayMs: null });
      this._startHeartbeat();
    };

    socket.onmessage = (ev: MessageEvent): void => {
      try {
        const json: unknown = JSON.parse(ev.data as string);

        // Intercept Pong before Zod validation (no payload field)
        if (
          json &&
          typeof json === "object" &&
          "type" in json &&
          (json as { type: string }).type === "Pong"
        ) {
          this._clearPongTimer();
          // Still notify listeners so the store can track heartbeat
          for (const l of this._messageListeners) {
            l({ type: "Pong" });
          }
          return;
        }

        const result = ServerEventSchema.safeParse(json);
        if (!result.success) {
          console.warn("[WS] Unknown/invalid event:", result.error.flatten());
          return;
        }
        for (const l of this._messageListeners) l(result.data);
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    socket.onerror = (): void => {
      if (!this.isReady()) {
        this._setState("backoff", { attempt: this._attempt, nextDelayMs: null });
      }
    };

    socket.onclose = (ev: CloseEvent): void => {
      this._socket = null;
      this._stopHeartbeat();

      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleUnload);
        window.removeEventListener("pagehide", handleUnload);
      }

      if (this._intentionalClose || ev.code === 1000) {
        this._setState("idle", { attempt: 0, nextDelayMs: null });
        return;
      }

      if (this._isAuthFailure(ev)) {
        this._attempt = 0;
        this._setState("auth_invalid", { attempt: 0, nextDelayMs: null });
        return;
      }

      this._scheduleReconnect();
    };
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this._pingTimer = setInterval(() => {
      if (!this.isReady()) return;
      this.send("Ping");
      this._pongTimer = setTimeout(() => {
        console.warn("[WS] Pong timeout — closing socket for reconnect");
        this._socket?.close(4000, "Pong timeout");
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private _stopHeartbeat(): void {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
    this._clearPongTimer();
  }

  private _clearPongTimer(): void {
    if (this._pongTimer) {
      clearTimeout(this._pongTimer);
      this._pongTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    this._attempt += 1;
    const delay = this._calcDelay(this._attempt);
    this._nextDelayMs = delay;
    const isDegraded = this._attempt > DEGRADED_THRESHOLD;

    this._setState(isDegraded ? "degraded" : "backoff", {
      attempt: this._attempt,
      nextDelayMs: delay,
    });

    this._reconnectTimer = setTimeout(() => {
      if (this._token) this._openSocket();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /** Exponential backoff with ±20% jitter. */
  private _calcDelay(attempt: number): number {
    const base = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
    const jitter = base * JITTER_FACTOR * (Math.random() * 2 - 1);
    return Math.round(base + jitter);
  }

  private _setState(state: ConnectionState, meta: StateMeta): void {
    this._state = state;
    this._nextDelayMs = meta.nextDelayMs;
    for (const l of this._stateListeners) l(state, meta);
  }

  private _isAuthFailure(ev: CloseEvent): boolean {
    const reason = ev.reason?.toLowerCase() ?? "";
    return (
      ev.code === 1008 ||
      reason.includes("unauthorized") ||
      reason.includes("invalid token") ||
      reason.includes("expired")
    );
  }
}

export const wsManager = WebSocketManager.getInstance();
