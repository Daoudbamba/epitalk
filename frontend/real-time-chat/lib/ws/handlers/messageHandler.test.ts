import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ─── Hoist mocks (must be declared before any vi.mock call) ───────────────────

const hoisted = vi.hoisted(() => {
  const authState = { user: { id: "current-user-id", username: "Me" } };
  const channelState: { activeChannelId: string | null } = {
    activeChannelId: "other-channel",
  };
  const serverState: { activeServerId: string | null; servers: unknown[] } = {
    activeServerId: "other-server",
    servers: [],
  };
  const notifMock = vi.fn();
  const addMessageMock = vi.fn();
  const updateMessageMock = vi.fn();
  const removeMessageMock = vi.fn();

  return {
    authState,
    channelState,
    serverState,
    notifMock,
    addMessageMock,
    updateMessageMock,
    removeMessageMock,
  };
});

vi.mock("@/store/auth.store", () => ({
  useAuthStore: { getState: () => hoisted.authState },
}));

vi.mock("@/store/channel.store", () => ({
  useChannelStore: { getState: () => hoisted.channelState },
}));

vi.mock("@/store/server.store", () => ({
  useServerStore: { getState: () => hoisted.serverState },
}));

vi.mock("@/store/message.store", () => ({
  useMessageStore: {
    getState: () => ({
      addMessage: hoisted.addMessageMock,
      updateMessage: hoisted.updateMessageMock,
      removeMessage: hoisted.removeMessageMock,
      messages: {},
    }),
  },
}));

vi.mock("@/store/notifications.store", () => ({
  useNotificationStore: {
    getState: () => ({ showNotification: hoisted.notifMock }),
  },
}));

import { messageHandler } from "./messageHandler";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNotif(overrides: Partial<{
  server_id: string;
  server_name: string;
  channel_id: string;
  channel_name: string;
  message_id: string;
  author_id: string;
  author_username: string;
  content: string;
  created_at: string;
  attachment_url: string | null | undefined;
}> = {}) {
  return {
    server_id: "server-1",
    server_name: "My Server",
    channel_id: "channel-notif",
    channel_name: "general",
    message_id: `msg-${Math.random()}`,
    author_id: "other-user",
    author_username: "Alice",
    content: "Hello!",
    created_at: new Date().toISOString(),
    attachment_url: null,
    ...overrides,
  };
}

// ─── Tests for onMessageNotification ─────────────────────────────────────────

describe("messageHandler.onMessageNotification()", () => {
  beforeEach(() => {
    hoisted.notifMock.mockClear();
    hoisted.channelState.activeChannelId = "other-channel";
    hoisted.serverState.activeServerId = "other-server";
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a notification for a fresh message from another user in an inactive channel", () => {
    messageHandler.onMessageNotification(makeNotif());

    expect(hoisted.notifMock).toHaveBeenCalledOnce();
    const call = hoisted.notifMock.mock.calls[0][0];
    expect(call.type).toBe("server_message");
    expect(call.title).toBe("#general — My Server");
    expect(call.message).toBe("Alice: Hello!");
  });

  it("skips notification for own messages (author_id === currentUser.id)", () => {
    messageHandler.onMessageNotification(
      makeNotif({ author_id: "current-user-id" }),
    );

    expect(hoisted.notifMock).not.toHaveBeenCalled();
  });

  it("deduplicates: same message_id only triggers one notification", () => {
    const id = `dup-msg-${Math.random()}`;
    messageHandler.onMessageNotification(makeNotif({ message_id: id }));
    messageHandler.onMessageNotification(makeNotif({ message_id: id }));

    expect(hoisted.notifMock).toHaveBeenCalledOnce();
  });

  it("skips historical messages (older than 5 seconds)", () => {
    const oldDate = new Date(Date.now() - 10_000).toISOString();
    messageHandler.onMessageNotification(
      makeNotif({ created_at: oldDate }),
    );

    expect(hoisted.notifMock).not.toHaveBeenCalled();
  });

  it("suppresses notification when channel_id, server_id both match active and window is focused", () => {
    hoisted.channelState.activeChannelId = "channel-notif";
    hoisted.serverState.activeServerId = "server-1";
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    messageHandler.onMessageNotification(makeNotif());

    expect(hoisted.notifMock).not.toHaveBeenCalled();
  });

  it("shows notification when channel matches but server does NOT match (different server)", () => {
    hoisted.channelState.activeChannelId = "channel-notif";
    hoisted.serverState.activeServerId = "other-server"; // different server
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    messageHandler.onMessageNotification(makeNotif());

    expect(hoisted.notifMock).toHaveBeenCalledOnce();
  });

  it("shows notification when channel and server match but tab is backgrounded (not visible, not focused)", () => {
    hoisted.channelState.activeChannelId = "channel-notif";
    hoisted.serverState.activeServerId = "server-1";
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    messageHandler.onMessageNotification(makeNotif());

    expect(hoisted.notifMock).toHaveBeenCalledOnce();
  });

  it("suppresses notification when page is visible but window lacks keyboard focus (active channel)", () => {
    hoisted.channelState.activeChannelId = "channel-notif";
    hoisted.serverState.activeServerId = "server-1";
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    messageHandler.onMessageNotification(makeNotif());

    expect(hoisted.notifMock).not.toHaveBeenCalled();
  });

  it("shows notification for a different channel even when server matches and window is focused", () => {
    hoisted.channelState.activeChannelId = "other-channel";
    hoisted.serverState.activeServerId = "server-1";
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    messageHandler.onMessageNotification(makeNotif());

    expect(hoisted.notifMock).toHaveBeenCalledOnce();
  });

  it("formats GIF content as '🖼 GIF'", () => {
    const gifContent = JSON.stringify({
      type: "gif",
      gif: { id: "g1", url: "https://example.com/g.gif" },
      caption: "",
    });
    messageHandler.onMessageNotification(makeNotif({ content: gifContent }));

    const call = hoisted.notifMock.mock.calls[0][0];
    expect(call.message).toBe("Alice: 🖼 GIF");
  });

  it("formats attachment presence as '📎 Fichier'", () => {
    messageHandler.onMessageNotification(
      makeNotif({ attachment_url: "https://cdn.example.com/file.pdf" }),
    );

    const call = hoisted.notifMock.mock.calls[0][0];
    expect(call.message).toContain("📎");
  });

  it("includes the correct channel and server in notification data", () => {
    messageHandler.onMessageNotification(
      makeNotif({
        channel_id: "ch-99",
        channel_name: "announcements",
        server_id: "srv-42",
        server_name: "EpiTalk HQ",
      }),
    );

    const call = hoisted.notifMock.mock.calls[0][0];
    expect(call.data.channelId).toBe("ch-99");
    expect(call.data.serverId).toBe("srv-42");
    expect(call.title).toBe("#announcements — EpiTalk HQ");
  });
});
