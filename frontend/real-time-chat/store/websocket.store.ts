import { create } from "zustand";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore } from "@/store/auth.store";
import { useDmStore } from "@/store/dm.store";

// Types basés sur le protocole WebSocket du backend
export interface WsMessage {
  id: string;
  channel_id: string;
  author_id: string;
  username?: string;
  content: string;
  created_at: string;
  reply_to?: string;
  reactions?: Array<{
    emoji: string;
    user_id: string;
    username?: string;
    created_at?: string;
  }>;
  edited_at?: string;
  pinned_by?: string | null;
  pinned_at?: string | null;
}

// CLIENT → SERVER events
type ClientEvent =
  | {
      type: "MessageSend";
      payload: { channel_id: string; content: string; reply_to?: string };
    }
  | {
      type: "MessageSchedule";
      payload: {
        channel_id: string;
        content: string;
        day_of_week: number;
        hour: number;
        minute: number;
        reply_to?: string;
      };
    }
  | {
      type: "MessageEdit";
      payload: { channel_id: string; message_id: string; content: string };
    }
  | {
      type: "MessageDelete";
      payload: { channel_id: string; message_id: string };
    }
  | { type: "JoinChannel"; payload: { channel_id: string } }
  | { type: "LeaveChannel"; payload: { channel_id: string } }
  | { type: "TypingStart"; payload: { channel_id: string } }
  | { type: "TypingStop"; payload: { channel_id: string } }
  | { type: "Ping" }
  | {
      type: "DmSend";
      payload: { recipient_id: string; content: string; reply_to?: string };
    }
  | {
      type: "DmEdit";
      payload: { conversation_id: string; message_id: string; content: string };
    }
  | {
      type: "DmDelete";
      payload: { conversation_id: string; message_id: string };
    }
  | {
      type: "DmSendGif";
      payload: {
        recipient_id: string;
        gif: { id: string; url: string; preview?: string; provider?: string };
        caption?: string | null;
      };
    }
  | { type: "JoinDm"; payload: { peer_id: string } }
  | { type: "LeaveDm"; payload: { peer_id: string } }
  | {
      type: "MessageSendGif";
      payload: {
        channel_id: string;
        gif: { id: string; url: string; preview?: string; provider?: string };
        caption?: string | null;
      };
    }
  | {
      type: "PresenceSet";
      payload: { status: "online" | "idle" | "dnd" | "offline" };
    };

// SERVER → CLIENT events
type ServerEvent =
  | {
      type: "MessageNew";
      payload: {
        id: string;
        channel_id: string;
        author_id: string;
        username?: string;
        content: string;
        created_at: string;
        reply_to?: string;
        reactions?: { emoji: string; user_id: string; username?: string }[];
      };
    }
  | { type: "UserJoined"; payload: { user_id: string; channel_id: string } }
  | { type: "UserLeft"; payload: { user_id: string; channel_id: string } }
  | {
      type: "TypingStart";
      payload: { user_id: string; username: string; channel_id: string };
    }
  | {
      type: "TypingStop";
      payload: { user_id: string; username: string; channel_id: string };
    }
  | { type: "Pong" }
  | { type: "Error"; payload: { code: string; message: string } }
  | { type: "UserOnline"; payload: { user_id: string } }
  | { type: "UserOffline"; payload: { user_id: string } }
  | {
      type: "PresenceUpdated";
      payload: {
        user_id: string;
        status: "online" | "idle" | "dnd" | "offline";
        last_activity?: string;
      };
    }
  | {
      type: "MessageEdited";
      payload: {
        id: string;
        channel_id: string;
        author_id: string;
        username?: string;
        content: string;
        edited_at: string;
      };
    }
  | { type: "MessageDeleted"; payload: { id: string; channel_id: string } }
  | {
      type: "ReactionAdded";
      payload: {
        message_id: string;
        emoji: string;
        user_id: string;
        username?: string;
      };
    }
  | {
      type: "ReactionRemoved";
      payload: { message_id: string; emoji: string; user_id: string };
    }
  | { type: "Error"; payload: { code: string; message: string } }
  | {
      type: "DmNew";
      payload: {
        id: string;
        conversation_id: string;
        author_id: string;
        username: string;
        content: string;
        created_at: string;
        reply_to?: string;
      };
    }
  | {
      type: "DmEdited";
      payload: {
        id: string;
        conversation_id: string;
        author_id: string;
        username: string;
        content: string;
        edited_at: string;
      };
    }
  | { type: "DmDeleted"; payload: { id: string; conversation_id: string } }
  | { type: "Pong" };

type WebSocketState = {
  socket: WebSocket | null;
  isConnected: boolean;
  connectionState: "idle" | "connecting" | "connected" | "backoff" | "degraded" | "auth_invalid";
  reconnectAttempt: number;
  nextRetryDelayMs: number | null;
  messages: Record<string, WsMessage[]>; // channel_id -> messages
  dmMessages: Record<string, WsMessage[]>; // conversation_id -> messages
  currentChannelId: string | null;
  currentDmPeerId: string | null;
  typingUsers: Record<string, string[]>; // channel_id -> user_ids
  // presence: user_id -> { status, last_activity }
  presence: Record<
    string,
    { status: "online" | "idle" | "dnd" | "offline"; last_activity?: string }
  >;
  error: string | null;

  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (channelId: string, content: string, replyTo?: string) => void;
  sendScheduledMessage: (
    channelId: string,
    content: string,
    dayOfWeek: number,
    hour: number,
    minute: number,
    replyTo?: string,
  ) => void;
  editMessage: (channelId: string, messageId: string, content: string) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;
  getMessages: (channelId: string) => WsMessage[];
  clearMessages: (channelId: string) => void;
  setCurrentChannel: (channelId: string | null) => void;
  setMessages: (channelId: string, messages: WsMessage[]) => void;
  // DM actions
  sendDm: (recipientId: string, content: string, replyTo?: string) => void;
  editDm: (conversationId: string, messageId: string, content: string) => void;
  deleteDm: (conversationId: string, messageId: string) => void;
  sendDmGif: (
    recipientId: string,
    gif: { id: string; url: string; preview?: string; provider?: string },
    caption?: string | null,
  ) => void;
  joinDm: (peerId: string) => void;
  leaveDm: (peerId: string) => void;
  getDmMessages: (conversationId: string) => WsMessage[];
  setCurrentDmPeer: (peerId: string | null) => void;
  // Presence control for the local user
  setPresence: (status: "online" | "idle" | "dnd" | "offline") => void;
};

// Default to backend port 3001 where the Rust server listens in dev
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
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

function getPeerIdFromConversation(conversationId: string, myId: string): string | null {
  if (!conversationId.startsWith("dm:")) return null;
  const parts = conversationId.slice(3).split(":");
  if (parts.length !== 2) return null;
  return parts[0] === myId ? parts[1] : parts[0];
}

function formatLastMessage(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === "gif") return "GIF";
  } catch {
    // Not JSON
  }
  return content;
}

function isEnglishPreferred(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("epitalk_language") === "en";
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  connectionState: "idle",
  reconnectAttempt: 0,
  nextRetryDelayMs: null,
  messages: {},
  dmMessages: {},
  currentChannelId: null,
  currentDmPeerId: null,
  typingUsers: {},
  presence: {},
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
    const handleUnload = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "Client disconnected");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleUnload);
      window.addEventListener("pagehide", handleUnload);
    }

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

      // Restore persisted presence status (optimistic local update + notify server)
      try {
        const stored =
          window.localStorage.getItem("presence_status") || "online";
        const storedStatus = stored as "online" | "idle" | "dnd" | "offline";
        const normalizedStatus = storedStatus === "offline" ? "online" : storedStatus;
        if (normalizedStatus !== storedStatus) {
          window.localStorage.setItem("presence_status", normalizedStatus);
        }
        // Apply optimistic presence locally so UI shows immediately
        const authUser = useAuthStore.getState().user;
        if (authUser) {
          set((s) => {
            const newPresence = { ...s.presence };
            newPresence[authUser.id] = {
              status: normalizedStatus,
              last_activity: new Date().toISOString(),
            };
            return { presence: newPresence };
          });
        }
        // Send PresenceSet to server so server becomes authoritative
        const evt: ClientEvent = {
          type: "PresenceSet",
          payload: { status: normalizedStatus },
        };
        if (socket && socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify(evt));
      } catch (e) {
        console.warn("Failed to restore presence from localStorage:", e);
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
      console.warn("⚠️ WebSocket error:", error);
      if (!get().isConnected) {
        set({
          connectionState: "backoff",
          error: isEnglishPreferred()
            ? "Unstable WebSocket connection. Reconnecting..."
            : "Connexion WebSocket instable. Reconnexion en cours...",
        });
      }
    };

    socket.onclose = (event) => {
      console.log("🔌 WebSocket disconnected:", event.code, event.reason);
      set({ socket: null, isConnected: false });

      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleUnload);
        window.removeEventListener("pagehide", handleUnload);
      }

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

  sendMessage: (channelId: string, content: string, replyTo?: string) => {
    const { socket, currentChannelId } = get();
    console.log("📤 Sending message:", {
      channelId,
      content,
      replyTo,
      socketState: socket?.readyState,
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
      if (currentChannelId !== channelId) {
        get().joinChannel(channelId);
      }
      const event: ClientEvent = {
        type: "MessageSend",
        payload: { channel_id: channelId, content, reply_to: replyTo },
      };
      const json = JSON.stringify(event);
      console.log("📤 Sending WebSocket event:", json);
      socket.send(json);
    } else {
      console.error("❌ Cannot send message: WebSocket not connected");
    }
  },

  sendScheduledMessage: (
    channelId: string,
    content: string,
    dayOfWeek: number,
    hour: number,
    minute: number,
    replyTo?: string,
  ) => {
    const { socket, currentChannelId } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (currentChannelId !== channelId) {
        get().joinChannel(channelId);
      }
      const event: ClientEvent = {
        type: "MessageSchedule",
        payload: {
          channel_id: channelId,
          content,
          day_of_week: dayOfWeek,
          hour,
          minute,
          reply_to: replyTo,
        },
      };
      socket.send(JSON.stringify(event));
    } else {
      console.error("❌ Cannot schedule message: WebSocket not connected");
    }
  },

  editMessage: (channelId: string, messageId: string, content: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "MessageEdit",
        payload: { channel_id: channelId, message_id: messageId, content },
      };
      socket.send(JSON.stringify(event));
    }
  },

  deleteMessage: (channelId: string, messageId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "MessageDelete",
        payload: { channel_id: channelId, message_id: messageId },
      };
      socket.send(JSON.stringify(event));
    }
  },

  joinChannel: (channelId: string) => {
    const { socket, currentChannelId } = get();

    console.log("🚪 Joining channel:", channelId);

    // Leave previous channel
    if (currentChannelId && currentChannelId !== channelId) {
      get().leaveChannel(currentChannelId);
    }

    // Always store the current channel so it can be joined on reconnect
    set({ currentChannelId: channelId });

    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "JoinChannel",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
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
    set((state) => {
      const existing = state.messages[channelId] || [];
      const byId = new Map<string, WsMessage>();

      for (const msg of existing) {
        byId.set(msg.id, msg);
      }
      for (const msg of newMessages) {
        // Prefer incoming data for edits/pins
        byId.set(msg.id, msg);
      }

      const merged = Array.from(byId.values()).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );

      return {
        messages: {
          ...state.messages,
          [channelId]: merged,
        },
      };
    });
  },

  // ─── DM Actions ────────────────────────────────────────────

  sendDm: (recipientId: string, content: string, replyTo?: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "DmSend",
        payload: { recipient_id: recipientId, content, reply_to: replyTo },
      };
      socket.send(JSON.stringify(event));
    }
  },

  editDm: (conversationId: string, messageId: string, content: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "DmEdit",
        payload: {
          conversation_id: conversationId,
          message_id: messageId,
          content,
        },
      };
      socket.send(JSON.stringify(event));
    }
  },

  deleteDm: (conversationId: string, messageId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "DmDelete",
        payload: { conversation_id: conversationId, message_id: messageId },
      };
      socket.send(JSON.stringify(event));
    }
  },

  sendDmGif: (
    recipientId: string,
    gif: { id: string; url: string; preview?: string; provider?: string },
    caption?: string | null,
  ) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "DmSendGif",
        payload: { recipient_id: recipientId, gif, caption },
      };
      socket.send(JSON.stringify(event));
    }
  },

  joinDm: (peerId: string) => {
    const { socket, currentDmPeerId } = get();

    // Leave previous DM room
    if (currentDmPeerId && currentDmPeerId !== peerId) {
      get().leaveDm(currentDmPeerId);
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "JoinDm",
        payload: { peer_id: peerId },
      };
      socket.send(JSON.stringify(event));
      set({ currentDmPeerId: peerId });
    }
  },

  leaveDm: (peerId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "LeaveDm",
        payload: { peer_id: peerId },
      };
      socket.send(JSON.stringify(event));
    }
    if (get().currentDmPeerId === peerId) {
      set({ currentDmPeerId: null });
    }
  },

  getDmMessages: (conversationId: string) => {
    const { dmMessages } = get();
    return dmMessages[conversationId] || [];
  },

  // Allow the client to set their presence status (sends PresenceSet to server)
  setPresence: (status: "online" | "idle" | "dnd" | "offline") => {
    if (status === "offline") {
      console.warn("Presence offline is automatic. Ignoring manual set.");
      return;
    }
    const { socket } = get();
    // Persist chosen status locally so reload can restore it
    try {
      window.localStorage.setItem("presence_status", status);
    } catch {}

    // Optimistically update local store so UI reflects change immediately
    const authUser = useAuthStore.getState().user;
    if (authUser) {
      set((s) => {
        const newPresence = { ...s.presence };
        newPresence[authUser.id] = {
          status,
          last_activity: new Date().toISOString(),
        };
        return { presence: newPresence };
      });
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not open, PresenceSet will be sent on reconnect");
      return;
    }

    const event: ClientEvent = { type: "PresenceSet", payload: { status } };
    socket.send(JSON.stringify(event));
  },

  setCurrentDmPeer: (peerId: string | null) => {
    set({ currentDmPeerId: peerId });
  },
}));

// Handle incoming server events
function handleServerEvent(
  event: ServerEvent,
  set: (
    partial:
      | Partial<WebSocketState>
      | ((state: WebSocketState) => Partial<WebSocketState>),
  ) => void,
) {
  console.log("🔔 Handling server event:", event.type, event);

  switch (event.type) {
    case "MessageNew": {
      const { id, channel_id, author_id, username, content, created_at } =
        event.payload;
      const newMessage: WsMessage = {
        id,
        channel_id,
        author_id,
        username,
        content,
        created_at,
        reply_to: event.payload.reply_to,
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

    case "ReactionAdded": {
      const { message_id, emoji, user_id, username } = event.payload;
      set((state) => {
        const newMessages = { ...state.messages } as Record<
          string,
          WsMessage[]
        >;

        // Try to find the message across all channels
        for (const [chanId, msgs] of Object.entries(newMessages)) {
          const idx = msgs.findIndex((m) => m.id === message_id);
          if (idx !== -1) {
            const target = msgs[idx];
            const existing = target.reactions || [];

            // Prevent duplicates: same user + same emoji
            const already = existing.some(
              (r) => r.user_id === user_id && r.emoji === emoji,
            );
            if (already) return state;

            const updated: WsMessage = {
              ...target,
              reactions: [...existing, { emoji, user_id, username }],
            };

            const updatedList = [...msgs];
            updatedList[idx] = updated;
            newMessages[chanId] = updatedList;

            return { messages: newMessages };
          }
        }

        // Also search in DM messages
        const newDmMessages = { ...state.dmMessages } as Record<
          string,
          WsMessage[]
        >;
        for (const [convId, msgs] of Object.entries(newDmMessages)) {
          const idx = msgs.findIndex((m) => m.id === message_id);
          if (idx !== -1) {
            const target = msgs[idx];
            const existing = target.reactions || [];
            const already = existing.some(
              (r) => r.user_id === user_id && r.emoji === emoji,
            );
            if (already) return state;
            const updated: WsMessage = {
              ...target,
              reactions: [...existing, { emoji, user_id, username }],
            };
            const updatedList = [...msgs];
            updatedList[idx] = updated;
            newDmMessages[convId] = updatedList;
            return { dmMessages: newDmMessages };
          }
        }

        return state;
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

    case "ReactionRemoved": {
      const { message_id, emoji, user_id } = event.payload;
      set((state) => {
        const newMessages = { ...state.messages } as Record<
          string,
          WsMessage[]
        >;
        for (const [chanId, msgs] of Object.entries(newMessages)) {
          const idx = msgs.findIndex((m) => m.id === message_id);
          if (idx !== -1) {
            const target = msgs[idx];
            const existing = target.reactions || [];

            const updatedReactions = existing.filter(
              (r) => !(r.user_id === user_id && r.emoji === emoji),
            );

            const updated: WsMessage = {
              ...target,
              reactions: updatedReactions,
            };

            const updatedList = [...msgs];
            updatedList[idx] = updated;
            newMessages[chanId] = updatedList;

            return { messages: newMessages };
          }
        }

        // Also search in DM messages
        const newDmMessages = { ...state.dmMessages } as Record<
          string,
          WsMessage[]
        >;
        for (const [convId, msgs] of Object.entries(newDmMessages)) {
          const idx = msgs.findIndex((m) => m.id === message_id);
          if (idx !== -1) {
            const target = msgs[idx];
            const existing = target.reactions || [];
            const updatedReactions = existing.filter(
              (r) => !(r.user_id === user_id && r.emoji === emoji),
            );
            const updated: WsMessage = {
              ...target,
              reactions: updatedReactions,
            };
            const updatedList = [...msgs];
            updatedList[idx] = updated;
            newDmMessages[convId] = updatedList;
            return { dmMessages: newDmMessages };
          }
        }

        return state;
      });
      break;
    }

    case "UserJoined": {
      console.log(
        `👋 User ${event.payload.user_id} joined channel ${event.payload.channel_id}`,
      );
      break;
    }

    case "UserLeft": {
      console.log(
        `👋 User ${event.payload.user_id} left channel ${event.payload.channel_id}`,
      );
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

    case "MessageEdited": {
      const { id, channel_id, content, edited_at } = event.payload;
      set((state) => {
        const channelMessages = state.messages[channel_id] || [];
        return {
          messages: {
            ...state.messages,
            [channel_id]: channelMessages.map((msg) =>
              msg.id === id ? { ...msg, content, edited_at } : msg,
            ),
          },
        };
      });
      break;
    }

    case "MessageDeleted": {
      const { id, channel_id } = event.payload;
      set((state) => {
        const channelMessages = state.messages[channel_id] || [];
        return {
          messages: {
            ...state.messages,
            [channel_id]: channelMessages.filter((msg) => msg.id !== id),
          },
        };
      });
      break;
    }

    case "UserOnline": {
      // Keep legacy behavior and also set presence
      set((state) => {
        const newPresence = { ...state.presence };
        newPresence[event.payload.user_id] = {
          status: "online",
          last_activity: new Date().toISOString(),
        };
        return { presence: newPresence };
      });
      break;
    }

    case "UserOffline": {
      set((state) => {
        const newPresence = { ...state.presence };
        delete newPresence[event.payload.user_id];
        // keep a record as offline with timestamp
        newPresence[event.payload.user_id] = {
          status: "offline",
          last_activity: new Date().toISOString(),
        };
        return { presence: newPresence };
      });
      break;
    }

    case "PresenceUpdated": {
      const { user_id, status, last_activity } = event.payload;
      set((state) => {
        const newPresence = { ...state.presence };
        newPresence[user_id] = { status, last_activity };
        return { presence: newPresence };
      });
      break;
    }

    case "Pong": {
      // Heartbeat received
      break;
    }

    case "Error": {
      if (event.payload.code === "BANNED") {
        console.warn("⚠️ Server error:", event.payload.code, event.payload.message);
        set((state) => {
          const channelId = state.currentChannelId;
          if (!channelId) {
            return {
              error: "[BANNED] Vous avez ete banni de ce serveur.",
              currentChannelId: null,
            };
          }

          const messages = { ...state.messages };
          const typingUsers = { ...state.typingUsers };
          delete messages[channelId];
          delete typingUsers[channelId];

          return {
            error: "[BANNED] Vous avez ete banni de ce serveur.",
            currentChannelId: null,
            messages,
            typingUsers,
          };
        });
        break;
      }

      if (event.payload.code === "NOT_MEMBER") {
        console.warn("⚠️ Server error:", event.payload.code, event.payload.message);
        set((state) => {
          const channelId = state.currentChannelId;
          if (!channelId) {
            return {
              error: "[NOT_MEMBER] Vous n'etes pas membre de ce serveur.",
              currentChannelId: null,
            };
          }

          const messages = { ...state.messages };
          const typingUsers = { ...state.typingUsers };
          delete messages[channelId];
          delete typingUsers[channelId];

          return {
            error: "[NOT_MEMBER] Vous n'etes pas membre de ce serveur.",
            currentChannelId: null,
            messages,
            typingUsers,
          };
        });
        break;
      }

      console.error(
        "❌ Server error:",
        event.payload.code,
        event.payload.message,
      );
      set({ error: `[${event.payload.code}] ${event.payload.message}` });
      break;
    }

    case "DmNew": {
      const {
        id,
        conversation_id,
        author_id,
        username,
        content,
        created_at,
        reply_to,
      } = event.payload;
      const newMessage: WsMessage = {
        id,
        channel_id: conversation_id,
        author_id,
        username,
        content,
        created_at,
        reply_to,
      };

      set((state) => {
        const convMessages = state.dmMessages[conversation_id] || [];

        // Avoid duplicates
        if (convMessages.some((m) => m.id === id)) {
          return state;
        }

        return {
          dmMessages: {
            ...state.dmMessages,
            [conversation_id]: [...convMessages, newMessage],
          },
        };
      });

      const authUser = useAuthStore.getState().user;
      if (authUser) {
        const peerId = getPeerIdFromConversation(conversation_id, authUser.id);
        if (peerId) {
          const convs = useDmStore.getState().conversations;
          const existing = convs.find((c) => c.peer_id === peerId);
          const peerUsername =
            author_id !== authUser.id
              ? username
              : existing?.peer_username || peerId.slice(0, 8);

          useDmStore.getState().addOrUpdateConversation({
            conversation_id,
            peer_id: peerId,
            peer_username: peerUsername,
            last_message: formatLastMessage(content),
            last_message_at: created_at,
          });
        }
      }
      break;
    }

    case "DmEdited": {
      const { id, conversation_id, content, edited_at } = event.payload;
      set((state) => {
        const convMessages = state.dmMessages[conversation_id] || [];
        return {
          dmMessages: {
            ...state.dmMessages,
            [conversation_id]: convMessages.map((msg) =>
              msg.id === id ? { ...msg, content, edited_at } : msg,
            ),
          },
        };
      });
      break;
    }

    case "DmDeleted": {
      const { id, conversation_id } = event.payload;
      set((state) => {
        const convMessages = state.dmMessages[conversation_id] || [];
        return {
          dmMessages: {
            ...state.dmMessages,
            [conversation_id]: convMessages.filter((msg) => msg.id !== id),
          },
        };
      });
      break;
    }

  }
}
