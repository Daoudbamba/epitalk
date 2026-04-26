"use client";

import { create } from "zustand";
import { wsManager } from "@/lib/ws/manager";
import { initEventBus } from "@/lib/ws/eventBus";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore } from "@/store/auth.store";
import { useMessageStore } from "@/store/message.store";
import { usePresenceStore } from "@/store/presence.store";
import { useTypingStore } from "@/store/typing.store";
import { useDmStore } from "@/store/dm.store";
import { useNotificationStore } from "@/store/notifications.store";
import { useChannelStore } from "@/store/channel.store";
import { useServerStore } from "@/store/server.store";

// Cache pour éviter les doublons de notifications (key = message_id, value = timestamp)
const notificationCache = new Map<string, number>();
const NOTIFICATION_DEDUP_TIME = 1000; // 1 seconde
import type { ConnectionState, WsMessage, PresenceStatus } from "@/lib/ws/types";

// Wire the EventBus once at module load (idempotent).
initEventBus();

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
      type: "MessagePinned";
      payload: {
        message_id: string;
        channel_id: string;
        pinned_by: string;
        pinned_at: string;
      };
    }
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
  // ── Connection state (owned here) ──────────────────────────────────────────
  socket: WebSocket | null; // raw socket — kept for backward compat with components that call socket.send()
  isConnected: boolean;
  connectionState: ConnectionState;
  reconnectAttempt: number;
  nextRetryDelayMs: number | null;
  currentChannelId: string | null;
  currentDmPeerId: string | null;
  error: string | null;

  // ── Mirrored from atomic stores (backward compat for existing components) ──
  messages: Record<string, WsMessage[]>;
  dmMessages: Record<string, WsMessage[]>;
  typingUsers: Record<string, string[]>;
  presence: Record<string, { status: PresenceStatus; last_activity?: string }>;

  // ── Connection ──────────────────────────────────────────────────────────────
  connect(token: string): void;
  disconnect(): void;

  // ── Channel messages ────────────────────────────────────────────────────────
  sendMessage(channelId: string, content: string, replyTo?: string, attachmentUrl?: string): void;
  editMessage(channelId: string, messageId: string, content: string): void;
  deleteMessage(channelId: string, messageId: string): void;
  sendGif(
    channelId: string,
    gif: { id: string; url: string; preview?: string; provider?: string },
    caption?: string | null,
  ): void;
  joinChannel(channelId: string): void;
  leaveChannel(channelId: string): void;
  startTyping(channelId: string): void;
  stopTyping(channelId: string): void;

  // ── Message helpers ─────────────────────────────────────────────────────────
  setMessages(channelId: string, msgs: WsMessage[]): void;
  getMessages(channelId: string): WsMessage[];
  clearMessages(channelId: string): void;
  setCurrentChannel(channelId: string | null): void;

  // ── DM ──────────────────────────────────────────────────────────────────────
  sendDm(recipientId: string, content: string, replyTo?: string, attachmentUrl?: string): void;
  editDm(conversationId: string, messageId: string, content: string): void;
  deleteDm(conversationId: string, messageId: string): void;
  sendDmGif(
    recipientId: string,
    gif: { id: string; url: string; preview?: string; provider?: string },
    caption?: string | null,
  ): void;
  joinDm(peerId: string): void;
  leaveDm(peerId: string): void;
  getDmMessages(conversationId: string): WsMessage[];
  setCurrentDmPeer(peerId: string | null): void;

  // ── Presence ────────────────────────────────────────────────────────────────
  setPresence(status: PresenceStatus): void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEnglish(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("epitalk_language") === "en";
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWebSocketStore = create<WebSocketState>((set, get) => {
  // ── React to manager state transitions ──────────────────────────────────────
  wsManager.onStateChange((state, meta) => {
    console.debug("[WS store] state →", state, "| attempt:", meta.attempt, "| nextDelay:", meta.nextDelayMs, "ms");
    set({
      connectionState: state,
      isConnected: state === "connected",
      reconnectAttempt: meta.attempt,
      nextRetryDelayMs: meta.nextDelayMs,
      socket: wsManager.getSocket(),
    });

    if (state === "connected") {
      // Restore presence from localStorage
      try {
        const stored =
          (localStorage.getItem("presence_status") as PresenceStatus | null) ?? "online";
        const status: PresenceStatus = stored === "offline" ? "online" : stored;
        localStorage.setItem("presence_status", status);

        const authUser = useAuthStore.getState().user;
        if (authUser) {
          usePresenceStore.getState().setUserPresence(authUser.id, status);
        }
        wsManager.send("PresenceSet", { status });
      } catch {
        // localStorage not available (SSR / private browsing)
      }

      // Rejoin active channel
      const channelId = get().currentChannelId;
      if (channelId) wsManager.send("JoinChannel", { channel_id: channelId });
    }

    if (state === "auth_invalid") {
      useAuthStore.getState().logout();
      set({
        error: isEnglish()
          ? "Session expired. Please log in again."
          : "Session expirée. Veuillez vous reconnecter.",
      });
    }

    // On non-intentional disconnect, verify token with REST before next reconnect
    if (state === "backoff" || state === "degraded") {
      void authApi.me().catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          wsManager.disconnect();
          useAuthStore.getState().logout();
          set({
            error: isEnglish()
              ? "Session expired. Please log in again."
              : "Session expirée. Veuillez vous reconnecter.",
            connectionState: "auth_invalid",
          });
        }
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

  // ── React to Error server events ────────────────────────────────────────────
  wsManager.onMessage((event) => {
    console.debug("[WS store] event received:", event.type);
    if (event.type !== "Error") return;
    const { code, message } = event.payload;

    if (code === "BANNED" || code === "NOT_MEMBER") {
      const channelId = get().currentChannelId;
      if (channelId) {
        useMessageStore.getState().clearChannel(channelId);
        useTypingStore.getState().clearChannel(channelId);
      }
      const label =
        code === "BANNED"
          ? isEnglish()
            ? "You have been banned from this server."
            : "Vous avez été banni de ce serveur."
          : isEnglish()
            ? "You are not a member of this server."
            : "Vous n'êtes pas membre de ce serveur.";
      set({ error: `[${code}] ${label}`, currentChannelId: null });
      return;
    }

    set({ error: `[${code}] ${message}` });
  });

  return {
    socket: null,
    isConnected: false,
    connectionState: "idle",
    reconnectAttempt: 0,
    nextRetryDelayMs: null,
    currentChannelId: null,
    currentDmPeerId: null,
    error: null,
    messages: {},
    dmMessages: {},
    typingUsers: {},
    presence: {},

  setCurrentDmPeer: (peerId: string | null) => {
    set({ currentDmPeerId: peerId });
  },

  loadMessages: async (channelId: string) => {
    try {
      const response = await fetch(`/api/channels/${channelId}/messages?limit=50`);
      if (!response.ok) throw new Error("Failed to load messages");
      const data = await response.json();
      if (Array.isArray(data)) {
        get().setMessages(channelId, data);
      }
    } catch (error) {
      console.error("Failed to load messages for channel:", channelId, error);
    }
  },

  loadDmMessages: async (conversationId: string) => {
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages?limit=50`
      );
      if (!response.ok) throw new Error("Failed to load DM messages");
      const data = await response.json();
      if (Array.isArray(data)) {
        set((state) => ({
          dmMessages: {
            ...state.dmMessages,
            [conversationId]: data,
          },
        }));
      }
    } catch (error) {
      console.error("Failed to load DM messages for conversation:", conversationId, error);
    }
  },
    }),
    {
      name: "websocket-store",
      partialize: (state) => ({
        messages: state.messages,
        dmMessages: state.dmMessages,
        currentChannelId: state.currentChannelId,
        currentDmPeerId: state.currentDmPeerId,
        presence: state.presence,
      }),
      version: 1,
    },
  ),
);

/**
 * Trigger a notification for a new message in a channel/server
 * Uses cached channel/server data from stores and fetches if needed
 */
async function triggerMessageNotification(
  channelId: string,
  username: string,
  content: string,
  authorId: string
) {
  try {
    console.log("🔔 [ServerNotif] ===== START =====");
    console.log("🔔 [ServerNotif] Channel:", channelId, "Username:", username, "Content:", content.substring(0, 20));
    
    // Check dedup cache
    if (notificationCache.has(`msg-${channelId}`)) {
      const lastTime = notificationCache.get(`msg-${channelId}`) || 0;
      if (Date.now() - lastTime < NOTIFICATION_DEDUP_TIME) {
        console.log("🔔 [ServerNotif] ❌ SKIPPED - duplicate within", NOTIFICATION_DEDUP_TIME, "ms");
        return;
      }
    }
    notificationCache.set(`msg-${channelId}`, Date.now());
    console.log("🔔 [ServerNotif] ✅ Passed dedup check");
    
    const notificationStore = useNotificationStore.getState();
    const currentUser = useAuthStore.getState().user;
    
    console.log("🔔 [ServerNotif] Current user ID:", currentUser?.id);
    console.log("🔔 [ServerNotif] Message author ID:", authorId);
    
    // Don't notify if the author is the current user (don't notify about own messages)
    if (authorId === currentUser?.id) {
      console.log("🔔 [ServerNotif] ❌ SKIPPED - this is our own message");
      return;
    }

    // Try to get channel name from local store
    const channelStore = useChannelStore.getState();
    console.log("🔔 [ServerNotif] Available channels in store:", channelStore.channels.length);
    
    const localChannel = channelStore.channels.find((c) => c.id === channelId);
    console.log("🔔 [ServerNotif] Found channel in store:", localChannel?.name || "NOT FOUND");
    
    const channelName = localChannel?.name || "channel";
    const serverId = localChannel?.server_id;

    // Try to get server name from local store
    const serverStore = useServerStore.getState();
    console.log("🔔 [ServerNotif] Available servers in store:", serverStore.servers.length);
    
    const localServer = serverId ? serverStore.servers.find((s) => s.id === serverId) : null;
    console.log("🔔 [ServerNotif] Found server in store:", localServer?.name || "NOT FOUND");
    
    const serverName = localServer?.name || "Serveur";

    // Format the notification message
    const displayContent = content.length > 50 
      ? content.substring(0, 47) + "..."
      : content;

    console.log("🔔 [ServerNotif] 📢 SHOWING NOTIFICATION:");
    console.log("   Title:", `${username} in ${serverName}`);
    console.log("   Message:", `#${channelName}: ${displayContent}`);

    // Show the notification - ALWAYS show it for server messages
    const result = notificationStore.showNotification({
      type: "server_message",
      title: `${username} in ${serverName}`,
      message: `#${channelName}: ${displayContent}`,
      // Don't pass userId - it's not a DM, it's a channel message
      data: {
        channelId,
        channelName,
        serverId,
        serverName,
      },
    });
    
    console.log("🔔 [ServerNotif] ===== END (SUCCESS) =====");
  } catch (error) {
    console.error("🔔 [ServerNotif] ❌ ERROR:", error);
  }
}

    connect(token) {
      wsManager.connect(token);
    },

    disconnect() {
      wsManager.disconnect();
    },

    // ── Channel messages ──────────────────────────────────────────────────────

    sendMessage(channelId, content, replyTo, attachmentUrl) {
      if (get().currentChannelId !== channelId) get().joinChannel(channelId);
      wsManager.send("MessageSend", {
        channel_id: channelId,
        content,
        reply_to: replyTo,
        attachment_url: attachmentUrl,
      });

      // Trigger notification for new server message
      triggerMessageNotification(channel_id, username || author_id, content, author_id);

      break;
    }

    case "ReactionAdded": {
      const { message_id, emoji, user_id, username } = event.payload;
      set((state) => {
        const newMessages = { ...state.messages } as Record<
          string,
          WsMessage[]
        >;

    editMessage(channelId, messageId, content) {
      wsManager.send("MessageEdit", {
        channel_id: channelId,
        message_id: messageId,
        content,
      });
    },

    deleteMessage(channelId, messageId) {
      wsManager.send("MessageDelete", {
        channel_id: channelId,
        message_id: messageId,
      });
    },

    sendGif(channelId, gif, caption) {
      wsManager.send("MessageSendGif", { channel_id: channelId, gif, caption });
    },

    joinChannel(channelId) {
      const { currentChannelId } = get();
      if (currentChannelId && currentChannelId !== channelId) {
        get().leaveChannel(currentChannelId);
      }
      set({ currentChannelId: channelId });
      useMessageStore.getState().setCurrentChannel(channelId);
      wsManager.send("JoinChannel", { channel_id: channelId });
    },

    leaveChannel(channelId) {
      wsManager.send("LeaveChannel", { channel_id: channelId });
    },

    startTyping(channelId) {
      wsManager.send("TypingStart", { channel_id: channelId });
    },

    stopTyping(channelId) {
      wsManager.send("TypingStop", { channel_id: channelId });
    },

    // ── Message helpers ───────────────────────────────────────────────────────

    setMessages(channelId, msgs) {
      useMessageStore.getState().setMessages(channelId, msgs);
    },

    getMessages(channelId) {
      return useMessageStore.getState().getMessages(channelId);
    },

    clearMessages(channelId) {
      useMessageStore.getState().clearChannel(channelId);
    },

    setCurrentChannel(channelId) {
      set({ currentChannelId: channelId });
      useMessageStore.getState().setCurrentChannel(channelId);
    },

    // ── DM ────────────────────────────────────────────────────────────────────

    sendDm(recipientId, content, replyTo, attachmentUrl) {
      wsManager.send("DmSend", {
        recipient_id: recipientId,
        content,
        reply_to: replyTo,
        attachment_url: attachmentUrl,
      });
    },

    editDm(conversationId, messageId, content) {
      wsManager.send("DmEdit", {
        conversation_id: conversationId,
        message_id: messageId,
        content,
      });
    },

    deleteDm(conversationId, messageId) {
      wsManager.send("DmDelete", {
        conversation_id: conversationId,
        message_id: messageId,
      });
    },

    sendDmGif(recipientId, gif, caption) {
      wsManager.send("DmSendGif", { recipient_id: recipientId, gif, caption });
    },

    joinDm(peerId) {
      const { currentDmPeerId } = get();
      if (currentDmPeerId && currentDmPeerId !== peerId) get().leaveDm(currentDmPeerId);
      set({ currentDmPeerId: peerId });
      wsManager.send("JoinDm", { peer_id: peerId });
    },

    leaveDm(peerId) {
      wsManager.send("LeaveDm", { peer_id: peerId });
      if (get().currentDmPeerId === peerId) set({ currentDmPeerId: null });
    },

    getDmMessages(conversationId) {
      return useDmStore.getState().getDmMessages(conversationId);
    },

    setCurrentDmPeer(peerId) {
      set({ currentDmPeerId: peerId });
    },

    // ── Presence ──────────────────────────────────────────────────────────────

    setPresence(status) {
      if (status === "offline") return; // offline is set automatically by the server
      try {
        localStorage.setItem("presence_status", status);
      } catch {
        // ignore
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
      
      // Check dedup cache for DM - skip if duplicate
      let shouldShowNotification = true;
      if (notificationCache.has(id)) {
        const lastTime = notificationCache.get(id) || 0;
        if (Date.now() - lastTime < NOTIFICATION_DEDUP_TIME) {
          console.log("🔔 [DM Notification] Skipped - duplicate within", NOTIFICATION_DEDUP_TIME, "ms");
          shouldShowNotification = false;
        }
      }
      notificationCache.set(id, Date.now());
      
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

          // Show notification if message is from someone else and passed dedup check
          if (author_id !== authUser.id && shouldShowNotification) {
            // Check if message is historical (more than 5 seconds old)
            const messageTime = new Date(created_at).getTime();
            const now = Date.now();
            const isHistorical = now - messageTime > 5000; // 5 seconds threshold
            
            console.log("🔔 [DM Notification] Showing notification for message:", id);
            useNotificationStore.getState().showNotification({
              type: "dm",
              title: `Message de ${peerUsername}`,
              message: formatLastMessage(content),
              userId: author_id,
              data: { conversation_id, peerId },
              isHistorical,
            });
          }
        }
      }
      wsManager.send("PresenceSet", { status });
    },
  };
});

// ─── Backward-compat bridge ───────────────────────────────────────────────────
// Atomic stores are the source of truth. These subscriptions mirror their state
// into useWebSocketStore so existing components that read
// useWebSocketStore(s => s.messages / s.presence / etc.) keep working.

useMessageStore.subscribe((s) => {
  useWebSocketStore.setState({ messages: s.messages });
});

usePresenceStore.subscribe((s) => {
  useWebSocketStore.setState({ presence: s.presence });
});

useTypingStore.subscribe((s) => {
  useWebSocketStore.setState({ typingUsers: s.typingUsers });
});

useDmStore.subscribe((s) => {
  useWebSocketStore.setState({ dmMessages: s.dmMessages });
});

// Re-export WsMessage for components that import it from here
export type { WsMessage } from "@/lib/ws/types";
