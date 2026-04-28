import type { z } from "zod";
import type { UserJoinedSchema, UserLeftSchema, BannedSchema } from "@/lib/ws/types";
import { useServerStore } from "@/store/server.store";

type UserJoined = z.infer<typeof UserJoinedSchema>;
type UserLeft = z.infer<typeof UserLeftSchema>;
type Banned = z.infer<typeof BannedSchema>;

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
    // Remove the banned server from the local store and show the ban modal.
    store.removeServer(payload.server_id);
    store.showBanModal({
      serverId: payload.server_id,
      serverName: store.servers.find((s) => s.id === payload.server_id)?.name ?? "ce serveur",
      expiresAt: payload.expires_at ?? null,
      reason: payload.reason ?? null,
    });
  },
};
