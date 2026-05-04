import type { z } from "zod";
import type { UserJoinedSchema, UserLeftSchema, BannedSchema, KickedSchema, BanLiftedSchema } from "@/lib/ws/types";
import { useServerStore } from "@/store/server.store";
import { serversApi } from "@/lib/api";

type UserJoined = z.infer<typeof UserJoinedSchema>;
type UserLeft = z.infer<typeof UserLeftSchema>;
type Banned = z.infer<typeof BannedSchema>;
type Kicked = z.infer<typeof KickedSchema>;
type BanLifted = z.infer<typeof BanLiftedSchema>;

/**
 * Handles channel membership presence events and moderation events (ban).
 */
export const memberHandler = {
  onUserJoined(payload: UserJoined): void {
    console.debug("[MemberHandler] joined", payload.user_id, payload.channel_id);
  },

  onUserLeft(payload: UserLeft): void {
    console.debug("[MemberHandler] left", payload.user_id, payload.channel_id);
  },

  onBanned(payload: Banned): void {
    console.debug("[MemberHandler] banned from server", payload.server_id);
    const store = useServerStore.getState();
    store.removeServer(payload.server_id);
    store.showBanModal({
      serverId: payload.server_id,
      serverName: store.servers.find((s) => s.id === payload.server_id)?.name ?? "ce serveur",
      expiresAt: payload.expires_at ?? null,
      reason: payload.reason ?? null,
    });
  },

  onKicked(payload: Kicked): void {
    console.debug("[MemberHandler] kicked from server", payload.server_id);
    const store = useServerStore.getState();
    const serverName = store.servers.find((s) => s.id === payload.server_id)?.name ?? "ce serveur";
    store.removeServer(payload.server_id);
    store.showKickModal({
      serverId: payload.server_id,
      serverName,
      reason: payload.reason ?? null,
    });
  },

  onBanLifted(payload: BanLifted): void {
    console.debug("[MemberHandler] ban lifted for server", payload.server_id);
    // Fetch the server info and add it back to the server list
    serversApi.get(payload.server_id)
      .then((server) => {
        const store = useServerStore.getState();
        const alreadyMember = store.servers.some((s) => s.id === server.id);
        if (!alreadyMember) {
          store.setServers([...store.servers, server]);
        }
      })
      .catch(() => {
        // Server might not be fetchable yet — user can refresh manually
        console.warn("[MemberHandler] could not fetch re-joined server", payload.server_id);
      });
  },
};
