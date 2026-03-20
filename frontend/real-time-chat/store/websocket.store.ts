import { create } from "zustand";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore } from "@/store/auth.store";

// Types basés sur le protocole WebSocket du backend
export interface WsMessage {
  id: string;
  channel_id: string;
  author_id: string;
  username?: string;
  content: string;
  created_at: string;
  edited_at?: string;
  pinned_by?: string | null;
  pinned_at?: string | null;
}

// CLIENT → SERVER events
type ClientEvent =
  | { type: "MessageSend"; payload: { channel_id: string; content: string } }
  | { type: "JoinChannel"; payload: { channel_id: string } }
  | { type: "LeaveChannel"; payload: { channel_id: string } }
  | { type: "TypingStart"; payload: { channel_id: string } }
  | { type: "TypingStop"; payload: { channel_id: string } }
  | { type: "Ping" };

// SERVER → CLIENT events
type ServerEvent =
  | { type: "MessageNew"; payload: { id: string; channel_id: string; author_id: string; username?: string; content: string; created_at: string } }
  | { type: "MessageUpdated"; payload: { id: string; channel_id: string; author_id: string; username?: string; content: string; edited_at: string } }
  | { type: "MessagePinned"; payload: { message_id: string; channel_id: string; pinned_by: string; pinned_at: string } }
  | { type: "MessageUnpinned"; payload: { message_id: string; channel_id: string; unpinned_by: string; unpinned_at: string } }
  | { type: "UserJoined"; payload: { user_id: string; channel_id: string } }
  | { type: "UserLeft"; payload: { user_id: string; channel_id: string } }
  | { type: "TypingStart"; payload: { user_id: string; username: string; channel_id: string } }
  | { type: "TypingStop"; payload: { user_id: string; username: string; channel_id: string } }
  | { type: "Pong" }
  | { type: "Error"; payload: { code: string; message: string } }
  | { type: "UserOnline"; payload: { user_id: string } }
  | { type: "UserOffline"; payload: { user_id: string } };

type WebSocketState = {
  socket: WebSocket | null;
  isConnected: boolean;
  connectionState: "idle" | "connecting" | "connected" | "backoff" | "degraded" | "auth_invalid";
  reconnectAttempt: number;
  nextRetryDelayMs: number | null;
  messages: Record<string, WsMessage[]>; // channel_id -> messages
  currentChannelId: string | null;
  typingUsers: Record<string, string[]>; // channel_id -> user_ids
  onlineUsers: string[];
  error: string | null;

  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (channelId: string, content: string) => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;
  getMessages: (channelId: string) => WsMessage[];
  clearMessages: (channelId: string) => void;
  setCurrentChannel: (channelId: string | null) => void;
  setMessages: (channelId: string, messages: WsMessage[]) => void;
  clearError: () => void;
};

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const DEGRADED_RECONNECT_DELAY_MS = 30000;

let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function shouldForceAuthLogout(event: CloseEvent): boolean {
  const reason = event.reason?.toLowerCase() ?? "";
  return (
    event.code === 1008 ||
    reason.includes("unauthorized") ||
    reason.includes("invalid token") ||
    reason.includes("expired")
  );
}

function getLatestToken(): string | null {
  if (typeof window !== "undefined") {
    const fromStorage = localStorage.getItem("token");
    if (fromStorage) return fromStorage;
  }
  return useAuthStore.getState().token;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  connectionState: "idle",
  reconnectAttempt: 0,
  nextRetryDelayMs: null,
  messages: {},
  currentChannelId: null,
  typingUsers: {},
  onlineUsers: [],
  error: null,

  connect: (token: string) => {
    const existingSocket = get().socket;
    if (
      existingSocket &&
      (existingSocket.readyState === WebSocket.OPEN ||
        existingSocket.readyState === WebSocket.CONNECTING)
    ) {
      return; // Already connected or connecting
    }

    clearReconnectTimer();
    set({ connectionState: "connecting", nextRetryDelayMs: null, error: null });

    const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}`;
    console.log("🔌 Connecting to WebSocket:", wsUrl);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("✅ WebSocket connected");
      reconnectAttempts = 0;
      set({
        socket,
        isConnected: true,
        error: null,
        connectionState: "connected",
        reconnectAttempt: 0,
        nextRetryDelayMs: null,
      });

      // Rejoin current channel if any
      const currentChannel = get().currentChannelId;
      if (currentChannel) {
        get().joinChannel(currentChannel);
      }

      // Start ping interval
      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "Ping" }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        console.log("📨 WebSocket message received:", event.data);
        const serverEvent = JSON.parse(event.data) as ServerEvent;
        handleServerEvent(serverEvent, set);
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    socket.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      if (!get().isConnected) {
        set({ connectionState: "backoff" });
      }
    };

    socket.onclose = (event) => {
      console.log("🔌 WebSocket disconnected:", event.code, event.reason);
      set({ socket: null, isConnected: false });

      // Auto-reconnect with guardrails if not intentionally closed
      if (event.code !== 1000) {
        if (shouldForceAuthLogout(event)) {
          useAuthStore.getState().logout();
          reconnectAttempts = 0;
          clearReconnectTimer();
          set({
            error: "Session expirée. Veuillez vous reconnecter.",
            connectionState: "auth_invalid",
            reconnectAttempt: 0,
            nextRetryDelayMs: null,
          });
          return;
        }

        reconnectAttempts += 1;

        void (async () => {
          try {
            await authApi.me();
          } catch (error) {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
              useAuthStore.getState().logout();
              reconnectAttempts = 0;
              clearReconnectTimer();
              set({
                error: "Session expirée. Veuillez vous reconnecter.",
                connectionState: "auth_invalid",
                reconnectAttempt: 0,
                nextRetryDelayMs: null,
              });
              return;
            }
          }

          const isDegraded = reconnectAttempts > MAX_RECONNECT_ATTEMPTS;
          const delay = isDegraded
            ? DEGRADED_RECONNECT_DELAY_MS
            : Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1), 15000);

          set({
            connectionState: isDegraded ? "degraded" : "backoff",
            reconnectAttempt: reconnectAttempts,
            nextRetryDelayMs: delay,
            error: null,
          });

          clearReconnectTimer();
          reconnectTimer = setTimeout(() => {
            const state = get();
            const latestToken = getLatestToken();
            if (!state.isConnected && latestToken) {
              console.log("🔄 Attempting to reconnect...");
              state.connect(latestToken);
            }
          }, delay);
        })();
      } else {
        clearReconnectTimer();
        set({
          connectionState: "idle",
          reconnectAttempt: 0,
          nextRetryDelayMs: null,
        });
      }
    };

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    reconnectAttempts = 0;
    clearReconnectTimer();
    if (socket) {
      socket.close(1000, "User disconnected");
      set({
        socket: null,
        isConnected: false,
        connectionState: "idle",
        reconnectAttempt: 0,
        nextRetryDelayMs: null,
      });
    } else {
      set({
        connectionState: "idle",
        reconnectAttempt: 0,
        nextRetryDelayMs: null,
      });
    }
  },

  sendMessage: (channelId: string, content: string) => {
    const { socket } = get();
    console.log("📤 Sending message:", { channelId, content, socketState: socket?.readyState });
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "MessageSend",
        payload: { channel_id: channelId, content },
      };
      const json = JSON.stringify(event);
      console.log("📤 Sending WebSocket event:", json);
      socket.send(json);
    } else {
      console.error("❌ Cannot send message: WebSocket not connected");
    }
  },

  joinChannel: (channelId: string) => {
    const { socket, currentChannelId } = get();
    
    console.log("🚪 Joining channel:", channelId);
    
    // Leave previous channel
    if (currentChannelId && currentChannelId !== channelId) {
      get().leaveChannel(currentChannelId);
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "JoinChannel",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
      set({ currentChannelId: channelId });
    }
  },

  leaveChannel: (channelId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "LeaveChannel",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
    }
  },

  startTyping: (channelId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "TypingStart",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
    }
  },

  stopTyping: (channelId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "TypingStop",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
    }
  },

  getMessages: (channelId: string) => {
    const { messages } = get();
    return messages[channelId] || [];
  },

  clearMessages: (channelId: string) => {
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[channelId];
      return { messages: newMessages };
    });
  },

  setCurrentChannel: (channelId: string | null) => {
    set({ currentChannelId: channelId });
  },

  setMessages: (channelId: string, newMessages: WsMessage[]) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: newMessages,
      },
    }));
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Handle incoming server events
function handleServerEvent(
  event: ServerEvent,
  set: (partial: Partial<WebSocketState> | ((state: WebSocketState) => Partial<WebSocketState>)) => void
) {
  console.log("🔔 Handling server event:", event.type, event);
  
  switch (event.type) {
    case "MessageNew": {
      const { id, channel_id, author_id, username, content, created_at } = event.payload;
      const newMessage: WsMessage = {
        id,
        channel_id,
        author_id,
        username,
        content,
        created_at,
      };

      console.log("💬 New message received:", newMessage);

      set((state) => {
        const channelMessages = state.messages[channel_id] || [];
        
        // Avoid duplicates
        if (channelMessages.some((m) => m.id === id)) {
          return state;
        }
        
        return {
          messages: {
            ...state.messages,
            [channel_id]: [...channelMessages, newMessage],
          },
        };
      });
      break;
    }

    case "MessageUpdated": {
      const { id, channel_id, content, edited_at } = event.payload;
      set((state) => {
        const channelMessages = state.messages[channel_id] || [];
        return {
          messages: {
            ...state.messages,
            [channel_id]: channelMessages.map((message) =>
              message.id === id ? { ...message, content, edited_at } : message,
            ),
          },
        };
      });
      break;
    }

    case "MessagePinned": {
      const { message_id, channel_id, pinned_by, pinned_at } = event.payload;
      set((state) => {
        const channelMessages = state.messages[channel_id] || [];
        return {
          messages: {
            ...state.messages,
            [channel_id]: channelMessages.map((message) =>
              message.id === message_id ? { ...message, pinned_by, pinned_at } : message,
            ),
          },
        };
      });
      break;
    }

    case "MessageUnpinned": {
      const { message_id, channel_id } = event.payload;
      set((state) => {
        const channelMessages = state.messages[channel_id] || [];
        return {
          messages: {
            ...state.messages,
            [channel_id]: channelMessages.map((message) =>
              message.id === message_id ? { ...message, pinned_by: null, pinned_at: null } : message,
            ),
          },
        };
      });
      break;
    }

    case "UserJoined": {
      console.log(`👋 User ${event.payload.user_id} joined channel ${event.payload.channel_id}`);
      break;
    }

    case "UserLeft": {
      console.log(`👋 User ${event.payload.user_id} left channel ${event.payload.channel_id}`);
      break;
    }

    case "TypingStart": {
      const { username, channel_id } = event.payload;
      set((state) => {
        const channelTyping = state.typingUsers[channel_id] || [];
        if (channelTyping.includes(username)) {
          return state;
        }
        return {
          typingUsers: {
            ...state.typingUsers,
            [channel_id]: [...channelTyping, username],
          },
        };
      });
      break;
    }

    case "TypingStop": {
      const { username, channel_id } = event.payload;
      set((state) => {
        const channelTyping = state.typingUsers[channel_id] || [];
        return {
          typingUsers: {
            ...state.typingUsers,
            [channel_id]: channelTyping.filter((name) => name !== username),
          },
        };
      });
      break;
    }

    case "UserOnline": {
      set((state) => {
        if (state.onlineUsers.includes(event.payload.user_id)) {
          return state;
        }
        return {
          onlineUsers: [...state.onlineUsers, event.payload.user_id],
        };
      });
      break;
    }

    case "UserOffline": {
      set((state) => ({
        onlineUsers: state.onlineUsers.filter((id) => id !== event.payload.user_id),
      }));
      break;
    }

    case "Pong": {
      // Heartbeat received
      console.log("💓 Pong received");
      break;
    }

    case "Error": {
      set({ error: event.payload.message || "Erreur WebSocket" });
      break;
    }
  }
}
