"use client";

import { useEffect } from "react";
import { useWebSocketStore } from "@/store/websocket.store";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { channelsApi } from "@/lib/api";
import { wsManager } from "@/lib/ws/manager";

/**
 * On WS connect, silently subscribes to every channel of every joined server.
 * Uses wsManager.send directly (not the store's joinChannel) so navigation
 * state (currentChannelId) and LeaveChannel calls are not affected — only the
 * backend room membership changes, ensuring MessageNew events arrive for all
 * servers, not just the active one.
 * Re-runs whenever the connection is re-established or the server list grows.
 */
export function useJoinAllChannels() {
  const isConnected = useWebSocketStore((s) => s.isConnected);
  const serverCount = useServerStore((s) => s.servers.length);

  useEffect(() => {
    if (!isConnected || serverCount === 0) return;

    let cancelled = false;

    async function subscribeAll() {
      const servers = useServerStore.getState().servers;
      const { addChannelsForServer } = useChannelStore.getState();

      for (const server of servers) {
        if (cancelled) break;
        try {
          const channels = await channelsApi.listByServer(server.id);
          if (cancelled) break;
          addChannelsForServer(server.id, channels);
          for (const ch of channels) {
            wsManager.send("JoinChannel", { channel_id: ch.id });
          }
        } catch {
          // ignore per-server failures silently
        }
      }
    }

    void subscribeAll();
    return () => {
      cancelled = true;
    };
  }, [isConnected, serverCount]);
}
