import { describe, it, expect, beforeEach } from "vitest";
import { usePresenceStore } from "./presence.store";

describe("usePresenceStore", () => {
  beforeEach(() => {
    usePresenceStore.getState().reset();
  });

  // ─── setUserPresence ───────────────────────────────────────────────────────

  describe("setUserPresence()", () => {
    it("creates a presence record with the given status", () => {
      usePresenceStore.getState().setUserPresence("user1", "online");

      expect(usePresenceStore.getState().presence["user1"].status).toBe("online");
    });

    it("overwrites an existing status for the same user", () => {
      usePresenceStore.getState().setUserPresence("user1", "online");
      usePresenceStore.getState().setUserPresence("user1", "idle");

      expect(usePresenceStore.getState().presence["user1"].status).toBe("idle");
    });

    it("stores last_activity when explicitly provided", () => {
      const ts = "2024-06-01T12:00:00.000Z";
      usePresenceStore.getState().setUserPresence("user1", "online", ts);

      expect(usePresenceStore.getState().presence["user1"].last_activity).toBe(ts);
    });

    it("does not affect other users in the presence map", () => {
      usePresenceStore.getState().setUserPresence("user1", "online");
      usePresenceStore.getState().setUserPresence("user2", "dnd");

      expect(usePresenceStore.getState().presence["user1"].status).toBe("online");
      expect(usePresenceStore.getState().presence["user2"].status).toBe("dnd");
    });

    it("supports all valid statuses: online | idle | dnd | offline", () => {
      const statuses = ["online", "idle", "dnd", "offline"] as const;
      for (const s of statuses) {
        usePresenceStore.getState().setUserPresence("u", s);
        expect(usePresenceStore.getState().presence["u"].status).toBe(s);
      }
    });
  });

  // ─── setUserOffline ────────────────────────────────────────────────────────

  describe("setUserOffline()", () => {
    it("transitions an online user to offline", () => {
      usePresenceStore.getState().setUserPresence("user1", "online");
      usePresenceStore.getState().setUserOffline("user1");

      expect(usePresenceStore.getState().presence["user1"].status).toBe("offline");
    });

    it("creates an offline record for a previously untracked user", () => {
      usePresenceStore.getState().setUserOffline("ghost-user");

      expect(usePresenceStore.getState().presence["ghost-user"].status).toBe("offline");
    });
  });

  // ─── online count (derived) ────────────────────────────────────────────────

  describe("online count (computed from presence map)", () => {
    it("counts only users whose status is exactly 'online'", () => {
      usePresenceStore.getState().setUserPresence("u1", "online");
      usePresenceStore.getState().setUserPresence("u2", "online");
      usePresenceStore.getState().setUserPresence("u3", "idle");
      usePresenceStore.getState().setUserOffline("u4");

      const { presence } = usePresenceStore.getState();
      const count = Object.values(presence).filter((r) => r.status === "online").length;

      expect(count).toBe(2);
    });

    it("returns 0 when no user is online", () => {
      usePresenceStore.getState().setUserOffline("u1");
      usePresenceStore.getState().setUserPresence("u2", "idle");

      const { presence } = usePresenceStore.getState();
      const count = Object.values(presence).filter((r) => r.status === "online").length;

      expect(count).toBe(0);
    });

    it("returns 0 on a fresh store with no records", () => {
      const { presence } = usePresenceStore.getState();
      const count = Object.values(presence).filter((r) => r.status === "online").length;

      expect(count).toBe(0);
    });
  });

  // ─── reset ─────────────────────────────────────────────────────────────────

  describe("reset()", () => {
    it("wipes all presence records", () => {
      usePresenceStore.getState().setUserPresence("u1", "online");
      usePresenceStore.getState().setUserPresence("u2", "idle");
      usePresenceStore.getState().reset();

      expect(usePresenceStore.getState().presence).toEqual({});
    });
  });
});
