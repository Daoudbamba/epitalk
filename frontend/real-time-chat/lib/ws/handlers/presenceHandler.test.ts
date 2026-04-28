import { describe, it, expect, beforeEach } from "vitest";
import { presenceHandler } from "./presenceHandler";
import { usePresenceStore } from "@/store/presence.store";

// Uses the real Zustand store — reset before each test to avoid cross-test pollution.

describe("presenceHandler", () => {
  beforeEach(() => {
    usePresenceStore.getState().reset();
  });

  // ─── onUserOnline ──────────────────────────────────────────────────────────

  describe("onUserOnline()", () => {
    it("sets the user status to online in the presence store", () => {
      presenceHandler.onUserOnline({ user_id: "user1", status: "online" });

      expect(usePresenceStore.getState().presence["user1"].status).toBe("online");
    });

    it("creates a new record even when the user was previously absent", () => {
      presenceHandler.onUserOnline({ user_id: "new-user", status: "online" });

      expect(usePresenceStore.getState().presence["new-user"]).toBeDefined();
    });

    it("respects a preserved status sent on reconnect (e.g. idle)", () => {
      presenceHandler.onUserOnline({ user_id: "user1", status: "idle" });

      expect(usePresenceStore.getState().presence["user1"].status).toBe("idle");
    });

    it("respects dnd status on reconnect", () => {
      presenceHandler.onUserOnline({ user_id: "user1", status: "dnd" });

      expect(usePresenceStore.getState().presence["user1"].status).toBe("dnd");
    });

    it("does not affect other users already in the store", () => {
      usePresenceStore.getState().setUserPresence("other", "online");
      presenceHandler.onUserOnline({ user_id: "user1", status: "online" });

      expect(usePresenceStore.getState().presence["other"].status).toBe("online");
    });

    it("overwrites a previous status for the same user", () => {
      usePresenceStore.getState().setUserPresence("user1", "idle");
      presenceHandler.onUserOnline({ user_id: "user1", status: "online" });

      expect(usePresenceStore.getState().presence["user1"].status).toBe("online");
    });
  });

  // ─── onUserOffline ─────────────────────────────────────────────────────────

  describe("onUserOffline()", () => {
    it("sets the user status to offline in the presence store", () => {
      usePresenceStore.getState().setUserPresence("user1", "online");
      presenceHandler.onUserOffline({ user_id: "user1", status: "offline" });

      expect(usePresenceStore.getState().presence["user1"].status).toBe("offline");
    });

    it("creates an offline record for an untracked user", () => {
      presenceHandler.onUserOffline({ user_id: "ghost", status: "offline" });

      expect(usePresenceStore.getState().presence["ghost"].status).toBe("offline");
    });

    it("does not affect other users", () => {
      usePresenceStore.getState().setUserPresence("other", "online");
      presenceHandler.onUserOffline({ user_id: "user1", status: "offline" });

      expect(usePresenceStore.getState().presence["other"].status).toBe("online");
    });
  });
});
