import { describe, it, expect, beforeEach } from "vitest";
import { useMessageStore } from "./message.store";
import type { WsMessage } from "@/lib/ws/types";

function makeMsg(id: string, channelId: string, createdAt?: string): WsMessage {
  return {
    id,
    channel_id: channelId,
    author_id: "author1",
    content: `Message ${id}`,
    created_at: createdAt ?? "2024-01-01T00:00:00.000Z",
  };
}

describe("useMessageStore", () => {
  beforeEach(() => {
    useMessageStore.setState({ messages: {}, cursors: {}, currentChannelId: null });
  });

  // ─── addMessage ────────────────────────────────────────────────────────────

  describe("addMessage()", () => {
    it("appends a message to the correct channelId", () => {
      const msg = makeMsg("m1", "chan1");
      useMessageStore.getState().addMessage("chan1", msg);

      const stored = useMessageStore.getState().messages["chan1"];
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(msg);
    });

    it("does not affect other channels", () => {
      useMessageStore.getState().addMessage("chan1", makeMsg("m1", "chan1"));

      expect(useMessageStore.getState().messages["chan2"]).toBeUndefined();
    });

    it("does not add a duplicate (same id)", () => {
      const msg = makeMsg("m1", "chan1");
      useMessageStore.getState().addMessage("chan1", msg);
      useMessageStore.getState().addMessage("chan1", msg);

      expect(useMessageStore.getState().messages["chan1"]).toHaveLength(1);
    });

    it("appends multiple messages in insertion order", () => {
      useMessageStore.getState().addMessage("chan1", makeMsg("m1", "chan1"));
      useMessageStore.getState().addMessage("chan1", makeMsg("m2", "chan1"));

      const ids = useMessageStore.getState().messages["chan1"].map((m) => m.id);
      expect(ids).toEqual(["m1", "m2"]);
    });

    it("can hold messages for independent channels simultaneously", () => {
      useMessageStore.getState().addMessage("chan1", makeMsg("m1", "chan1"));
      useMessageStore.getState().addMessage("chan2", makeMsg("m2", "chan2"));

      expect(useMessageStore.getState().messages["chan1"]).toHaveLength(1);
      expect(useMessageStore.getState().messages["chan2"]).toHaveLength(1);
    });
  });

  // ─── prependMessages ───────────────────────────────────────────────────────

  describe("prependMessages()", () => {
    it("places older messages before existing ones", () => {
      useMessageStore.getState().addMessage("chan1", makeMsg("m3", "chan1"));

      useMessageStore
        .getState()
        .prependMessages("chan1", [makeMsg("m1", "chan1"), makeMsg("m2", "chan1")]);

      const ids = useMessageStore.getState().messages["chan1"].map((m) => m.id);
      expect(ids).toEqual(["m1", "m2", "m3"]);
    });

    it("does not create duplicates when all messages already exist", () => {
      const msg = makeMsg("m1", "chan1");
      useMessageStore.getState().addMessage("chan1", msg);

      const before = useMessageStore.getState().messages["chan1"];
      useMessageStore.getState().prependMessages("chan1", [msg]);
      const after = useMessageStore.getState().messages["chan1"];

      // prependMessages returns existing state unchanged when no new messages
      expect(after).toBe(before);
    });

    it("only prepends the non-duplicate portion on partial overlap", () => {
      useMessageStore.getState().addMessage("chan1", makeMsg("m2", "chan1"));
      useMessageStore
        .getState()
        .prependMessages("chan1", [makeMsg("m1", "chan1"), makeMsg("m2", "chan1")]);

      const ids = useMessageStore.getState().messages["chan1"].map((m) => m.id);
      expect(ids).toEqual(["m1", "m2"]);
      expect(useMessageStore.getState().messages["chan1"]).toHaveLength(2);
    });

    it("initialises the channel when there are no existing messages", () => {
      useMessageStore
        .getState()
        .prependMessages("chan1", [makeMsg("m1", "chan1"), makeMsg("m2", "chan1")]);

      expect(useMessageStore.getState().messages["chan1"]).toHaveLength(2);
    });
  });

  // ─── clearChannel ──────────────────────────────────────────────────────────

  describe("clearChannel()", () => {
    it("removes all messages for the given channelId", () => {
      useMessageStore.getState().addMessage("chan1", makeMsg("m1", "chan1"));
      useMessageStore.getState().clearChannel("chan1");

      expect(useMessageStore.getState().messages["chan1"]).toBeUndefined();
    });

    it("removes the pagination cursor for the given channelId", () => {
      useMessageStore.getState().setCursor("chan1", "cursor-abc");
      useMessageStore.getState().clearChannel("chan1");

      expect(useMessageStore.getState().cursors["chan1"]).toBeUndefined();
    });

    it("does not affect other channels", () => {
      useMessageStore.getState().addMessage("chan1", makeMsg("m1", "chan1"));
      useMessageStore.getState().addMessage("chan2", makeMsg("m2", "chan2"));
      useMessageStore.getState().clearChannel("chan1");

      expect(useMessageStore.getState().messages["chan2"]).toHaveLength(1);
    });

    it("is idempotent on an already-empty channel", () => {
      expect(() => useMessageStore.getState().clearChannel("chan-never-existed")).not.toThrow();
    });
  });
});
