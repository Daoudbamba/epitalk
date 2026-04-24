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
    usePresenceStore.getState().setUserPresence(payload.user_id, "online");
  },

  onUserOffline(payload: UserOffline): void {
    usePresenceStore.getState().setUserOffline(payload.user_id);
  },

  onPresenceUpdated(payload: PresenceUpdated): void {
    usePresenceStore
      .getState()
      .setUserPresence(payload.user_id, payload.status, payload.last_activity);
  },
};
