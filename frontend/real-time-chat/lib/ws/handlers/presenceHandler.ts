import { usePresenceStore } from "@/store/presence.store";
import type { z } from "zod";
import type {
  UserOnlineSchema,
  UserOfflineSchema,
  PresenceUpdatedSchema,
} from "@/lib/ws/types";

type UserOnline = z.infer<typeof UserOnlineSchema>;
type UserOffline = z.infer<typeof UserOfflineSchema>;
type PresenceUpdated = z.infer<typeof PresenceUpdatedSchema>;

export const presenceHandler = {
  onUserOnline(payload: UserOnline): void {
    console.debug(`Presence event: UserOnline ${payload.user_id} online`);
    usePresenceStore.getState().setUserPresence(payload.user_id, "online");
  },

  onUserOffline(payload: UserOffline): void {
    console.debug(`Presence event: UserOffline ${payload.user_id} offline`);
    usePresenceStore.getState().setUserOffline(payload.user_id);
  },

  onPresenceUpdated(payload: PresenceUpdated): void {
    console.debug(`Presence event: PresenceUpdated ${payload.user_id} ${payload.status}`);
    usePresenceStore
      .getState()
      .setUserPresence(payload.user_id, payload.status, payload.last_activity);
  },
};
