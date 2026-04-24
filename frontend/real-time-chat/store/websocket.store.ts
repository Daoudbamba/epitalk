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
import type { ConnectionState, WsMessage, PresenceStatus } from "@/lib/ws/types";

// Wire the EventBus once at module load (idempotent).
initEventBus();

// ─── Types ────────────────────────────────────────────────────────────────────

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
  sendMessage(channelId: string, content: string, replyTo?: string): void;
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
  sendDm(recipientId: string, content: string, replyTo?: string): void;
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
  });

  // ── React to Error server events ────────────────────────────────────────────
  wsManager.onMessage((event) => {
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

    // ── Connection ────────────────────────────────────────────────────────────

    connect(token) {
      wsManager.connect(token);
    },

    disconnect() {
      wsManager.disconnect();
    },

    // ── Channel messages ──────────────────────────────────────────────────────

    sendMessage(channelId, content, replyTo) {
      if (get().currentChannelId !== channelId) get().joinChannel(channelId);
      wsManager.send("MessageSend", {
        channel_id: channelId,
        content,
        reply_to: replyTo,
      });
    },

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

    sendDm(recipientId, content, replyTo) {
      wsManager.send("DmSend", {
        recipient_id: recipientId,
        content,
        reply_to: replyTo,
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
      const authUser = useAuthStore.getState().user;
      if (authUser) {
        usePresenceStore.getState().setUserPresence(authUser.id, status);
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
