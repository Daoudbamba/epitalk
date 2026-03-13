import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// note: avoid importing jest-dom to keep compatibility with Vitest globals
import { vi, describe, it, expect } from "vitest";

// Mock Zustand hooks used by ChatPanel: implement as selector functions
vi.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: any) =>
    sel({ user: { id: "user1", username: "Alice" }, token: "tok" }),
}));
vi.mock("@/store/member.store", () => ({
  useMemberStore: (sel: any) => sel({ members: [] }),
}));
vi.mock("@/store/server.store", () => ({
  useServerStore: (sel: any) => sel({ activeServerId: "server1" }),
}));
vi.mock("@/store/channel.store", () => ({
  useChannelStore: (sel: any) =>
    sel({
      channels: [{ id: "chan1", name: "general" }],
      activeChannelId: "chan1",
    }),
}));

const mockSend = vi.fn();
vi.mock("@/store/websocket.store", () => ({
  useWebSocketStore: (sel: any) =>
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
      joinChannel: () => {},
      startTyping: () => {},
      stopTyping: () => {},
      typingUsers: {},
    }),
}));

// Mock UI components and icons used by ChatPanel
vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));
vi.mock("lucide-react", () => ({
  Plus: (p: any) => <span {...p} />,
  Smile: (p: any) => <span {...p} />,
  Gift: (p: any) => <span {...p} />,
  Sticker: (p: any) => <span {...p} />,
  Send: (p: any) => <span {...p} />,
  Loader2: (p: any) => <span {...p} />,
}));

// Import the component (relative path)
import { ChatPanel } from "../app/(app)/servers/components/chat-panel";

describe("ChatPanel reactions tooltip and toggle", () => {
  it("shows tooltip card with usernames on hover and sends toggle event on click", async () => {
    render(<ChatPanel />);

    // Find the reaction button (emoji pill)
    const button = await screen.findByRole("button", { name: /😂/i });
    expect(button).toBeInTheDocument();

    // Hover to show tooltip
    fireEvent.mouseEnter(button);

    // Wait for the dialog to appear
    const dialog = await screen.findByRole("dialog", { name: /Réactions/i });
    expect(dialog).toBeInTheDocument();
    // fallback assertions without jest-dom matcher
    expect(dialog.textContent).toContain("Alice");
    expect(dialog.textContent).toContain("Bob");

    // Click to toggle: Alice already reacted, so clicking should send ReactionRemove
    fireEvent.click(button);
    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    const sent = mockSend.mock.calls[0][0];
    expect(typeof sent).toBe("string");
    const parsed = JSON.parse(sent);
    expect(parsed.type).toBe("ReactionRemove");
    expect(parsed.payload.message_id).toBe("m1");
    expect(parsed.payload.emoji).toBe("😂");
  });
});
