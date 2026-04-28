import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// note: avoid importing jest-dom to keep compatibility with Vitest globals
import { vi, describe, it, expect } from "vitest";

// Minimal slice types for selectors used in tests (avoid `any` in signatures)
type AuthSlice = { user: { id: string; username: string }; token: string };
type MemberSlice = { members: Array<{ user_id: string; username: string }> };
type ServerSlice = { activeServerId: string | null };
type ChannelSlice = {
  channels: { id: string; name: string }[];
  activeChannelId: string | null;
};
type WebSocketSlice = {
  socket: { readyState: number; send: (...args: unknown[]) => void } | null;
  isConnected: boolean;
  messages: Record<string, unknown[]>;
  connect: () => void;
  sendMessage: () => void;
  editMessage: () => void;
  deleteMessage: () => void;
  joinChannel: () => void;
  startTyping: () => void;
  stopTyping: () => void;
  typingUsers: Record<string, string[]>;
};

// Mock language provider (required by ChatPanel since it calls useLanguage)
vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ language: "fr" }),
}));

// Mock Zustand hooks used by ChatPanel: implement as selector functions
vi.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: AuthSlice) => unknown) =>
    sel({ user: { id: "user1", username: "Alice" }, token: "tok" }),
}));
vi.mock("@/store/member.store", () => ({
  useMemberStore: (sel: (s: MemberSlice) => unknown) => sel({ members: [] }),
}));
vi.mock("@/store/server.store", () => ({
  useServerStore: (sel: (s: ServerSlice) => unknown) =>
    sel({ activeServerId: "server1" }),
}));
vi.mock("@/store/channel.store", () => ({
  useChannelStore: (sel: (s: ChannelSlice) => unknown) =>
    sel({
      channels: [{ id: "chan1", name: "general" }],
      activeChannelId: "chan1",
    }),
}));

const mockSend = vi.fn();
vi.mock("@/store/websocket.store", () => ({
  useWebSocketStore: (sel: (s: WebSocketSlice) => unknown) =>
    sel({
      socket: { readyState: 1, send: mockSend },
      isConnected: true,
      messages: {
        chan1: [
          {
            id: "m1",
            channel_id: "chan1",
            author_id: "user2",
            username: "Bob",
            content: "Hello",
            created_at: new Date().toISOString(),
            reactions: [
              { emoji: "😂", user_id: "user1", username: "Alice" },
              { emoji: "😂", user_id: "user2", username: "Bob" },
            ],
          },
        ],
      },
      connect: () => {},
      sendMessage: () => {},
      editMessage: () => {},
      deleteMessage: () => {},
      joinChannel: () => {},
      startTyping: () => {},
      stopTyping: () => {},
      typingUsers: {},
    }),
}));

// Mock UI components and icons used by ChatPanel
vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ComponentProps<"button">) => <button {...props} />,
}));
// Universal icon stub: import the real module so Vitest validates exports correctly,
// then replace every capitalized export (icon component) with a lightweight <span>.
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Stub = (p: Record<string, unknown>) => React.createElement("span", p);
  const stubs = Object.fromEntries(
    Object.keys(actual)
      .filter((k) => /^[A-Z]/.test(k))
      .map((k) => [k, Stub]),
  );
  return { ...actual, ...stubs };
});

// Import the component (relative path)
import { ChatPanel } from "../app/(app)/servers/components/chat-panel";

describe("ChatPanel", () => {
  it("renders messages and shows username", async () => {
    render(<ChatPanel />);

    // The message content "Hello" from Bob should be visible
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
