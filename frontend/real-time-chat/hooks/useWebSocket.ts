"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { wsManager } from "@/lib/ws/manager";

/**
 * Mounts the WebSocket connection when a token is available and exposes
 * typed send helpers. Components should read state exclusively from
 * the atomic stores (useMessageStore, usePresenceStore, useTypingStore,
 * useDmStore) — never from the socket itself.
 */
export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const connect = useWebSocketStore((s) => s.connect);

  useEffect(() => {
    if (!hasHydrated || !token) return;
    // Only connect if the manager is fully idle (not reconnecting)
    if (!wsManager.isReady() && wsManager.getState() === "idle") {
      console.debug("[useWebSocket] token available, triggering connect | state:", wsManager.getState());
      connect(token);
    }
  }, [token, hasHydrated, connect]);

  return {
    // Channel messages
    sendMessage: useWebSocketStore((s) => s.sendMessage),
    editMessage: useWebSocketStore((s) => s.editMessage),
    deleteMessage: useWebSocketStore((s) => s.deleteMessage),
    sendGif: useWebSocketStore((s) => s.sendGif),

    // Channel participation
    joinChannel: useWebSocketStore((s) => s.joinChannel),
    leaveChannel: useWebSocketStore((s) => s.leaveChannel),

    // Typing
    sendTyping: useWebSocketStore((s) => s.startTyping),
    stopTyping: useWebSocketStore((s) => s.stopTyping),

    // DM
    sendDm: useWebSocketStore((s) => s.sendDm),
    editDm: useWebSocketStore((s) => s.editDm),
    deleteDm: useWebSocketStore((s) => s.deleteDm),
    sendDmGif: useWebSocketStore((s) => s.sendDmGif),
    joinDm: useWebSocketStore((s) => s.joinDm),
    leaveDm: useWebSocketStore((s) => s.leaveDm),

    // Presence
    setPresence: useWebSocketStore((s) => s.setPresence),

    // Connection
    disconnect: useWebSocketStore((s) => s.disconnect),
  };
}
