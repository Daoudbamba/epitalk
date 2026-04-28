import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Shared mutable state ──────────────────────────────────────────────────────
// vi.mock factories close over `state` at call-time, so mutations in beforeEach
// are reflected in each test's render.
//
// IMPORTANT: setMembers and setMembersLoading are in MembersPanel's useEffect
// dependency array. Returning a new vi.fn() on every render would invalidate the
// dep array and trigger an infinite re-run loop → stable references are required.

type Member = {
  user_id: string;
  username: string;
  role: string;
  avatar_url: string | null;
  status: string;
};
type PresenceRecord = { status: string; last_activity?: string };

const state = vi.hoisted(() => ({
  members: [] as Member[],
  presence: {} as Record<string, PresenceRecord>,
  currentUser: { id: "user1", username: "CurrentUser" } as { id: string; username: string },
  servers: [{ id: "server1", name: "Test Server", owner_id: "user1" }] as Array<{
    id: string;
    name: string;
    owner_id: string;
  }>,
  activeServerId: "server1" as string | null,
  // Stable references — must not be recreated between renders
  setMembers: vi.fn(),
  setMembersLoading: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  serversApi: {
    listMembers: vi.fn().mockResolvedValue([]),
    listBans: vi.fn().mockResolvedValue([]),
    kickMember: vi.fn().mockResolvedValue({}),
    banMember: vi.fn().mockResolvedValue({}),
    unbanMember: vi.fn().mockResolvedValue({}),
    updateMemberRole: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/api/errors", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, msg: string) {
      super(msg);
      this.status = status;
    }
  },
  getErrorMessage: (e: unknown) => String(e),
}));

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ language: "en" }),
}));

// Minimal UI stubs — avoids pulling in Radix / framer-motion
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
    disabled,
    className,
  }: React.ComponentProps<"button">) => (
    <button onClick={onClick} title={title} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/confirm-action-dialog", () => ({
  ConfirmActionDialog: () => null,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Zustand store mocks
vi.mock("@/store/presence.store", () => ({
  usePresenceStore: Object.assign(
    (sel: (s: { presence: Record<string, PresenceRecord> }) => unknown) =>
      sel({ presence: state.presence }),
    // getState() is invoked inside the useEffect to seed presence from the member list
    { getState: () => ({ setUserPresence: vi.fn(), setUserOffline: vi.fn() }) },
  ),
}));

vi.mock("@/store/member.store", () => ({
  useMemberStore: (
    sel: (s: {
      members: Member[];
      loading: boolean;
      setMembers: () => void;
      setLoading: () => void;
    }) => unknown,
  ) =>
    sel({
      members: state.members,
      loading: false,
      // Use stable references from state — new vi.fn() every render would
      // invalidate the useEffect dep array and create an infinite loop.
      setMembers: state.setMembers,
      setLoading: state.setMembersLoading,
    }),
}));

vi.mock("@/store/auth.store", () => ({
  useAuthStore: (sel: (s: { user: typeof state.currentUser }) => unknown) =>
    sel({ user: state.currentUser }),
}));

vi.mock("@/store/server.store", () => ({
  useServerStore: (
    sel: (s: {
      servers: typeof state.servers;
      activeServerId: typeof state.activeServerId;
    }) => unknown,
  ) => sel({ servers: state.servers, activeServerId: state.activeServerId }),
}));

vi.mock("@/store/websocket.store", () => ({
  useWebSocketStore: (sel: (s: { setPresence: () => void }) => unknown) =>
    sel({ setPresence: vi.fn() }),
}));

vi.mock("@/store/dm.store", () => ({
  useDmStore: (sel: (s: { setActivePeer: () => void }) => unknown) =>
    sel({ setActivePeer: vi.fn() }),
}));

// Component under test — imported after all mocks are registered
import { MembersPanel } from "../app/(app)/servers/components/members-panel";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const onRefresh = vi.fn().mockResolvedValue(undefined);

// Render and wait for the component to settle (async useEffect may update bans state)
async function renderPanel() {
  render(<MembersPanel onRefresh={onRefresh} />);
  // Flush microtasks produced by the mocked API promises
  await waitFor(() => expect(state.setMembersLoading).toHaveBeenCalled());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MembersPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable state to safe defaults; individual tests override as needed
    state.currentUser = { id: "owner-id", username: "Owner" };
    state.servers = [{ id: "server1", name: "Test Server", owner_id: "owner-id" }];
    state.activeServerId = "server1";
    state.members = [];
    state.presence = {};
  });

  // ─── Online count ──────────────────────────────────────────────────────────

  describe("online count", () => {
    it("shows the correct number of online members", async () => {
      state.members = [
        { user_id: "u1", username: "Alice", role: "Member", avatar_url: null, status: "ONLINE" },
        { user_id: "u2", username: "Bob", role: "Member", avatar_url: null, status: "ONLINE" },
        { user_id: "u3", username: "Charlie", role: "Member", avatar_url: null, status: "OFFLINE" },
        { user_id: "u4", username: "Dave", role: "Member", avatar_url: null, status: "IDLE" },
      ];
      state.presence = {
        u1: { status: "online" },
        u2: { status: "online" },
        u3: { status: "offline" },
        u4: { status: "idle" },
      };

      await renderPanel();

      expect(screen.getByText(/2 online/)).toBeInTheDocument();
    });

    it("shows 0 when no member is online", async () => {
      state.members = [
        { user_id: "u1", username: "Alice", role: "Member", avatar_url: null, status: "OFFLINE" },
        { user_id: "u2", username: "Bob", role: "Member", avatar_url: null, status: "IDLE" },
      ];
      state.presence = {
        u1: { status: "offline" },
        u2: { status: "idle" },
      };

      await renderPanel();

      expect(screen.getByText(/0 online/)).toBeInTheDocument();
    });

    it("shows the total member count in the heading", async () => {
      state.members = [
        { user_id: "u1", username: "Alice", role: "Member", avatar_url: null, status: "ONLINE" },
        { user_id: "u2", username: "Bob", role: "Member", avatar_url: null, status: "OFFLINE" },
      ];
      state.presence = { u1: { status: "online" }, u2: { status: "offline" } };

      await renderPanel();

      expect(screen.getByText(/Members \(2\)/)).toBeInTheDocument();
    });
  });

  // ─── Moderation "···" button visibility ───────────────────────────────────

  describe('moderation "···" button', () => {
    it("appears for an Owner viewing a non-owner member", async () => {
      state.currentUser = { id: "owner-id", username: "Owner" };
      state.servers = [{ id: "server1", name: "Server", owner_id: "owner-id" }];
      state.members = [
        { user_id: "owner-id", username: "Owner", role: "Owner", avatar_url: null, status: "ONLINE" },
        { user_id: "member-id", username: "Regular", role: "Member", avatar_url: null, status: "OFFLINE" },
      ];
      state.presence = {
        "owner-id": { status: "online" },
        "member-id": { status: "offline" },
      };

      await renderPanel();

      // The button is titled "Actions" in both locales
      expect(screen.getByTitle("Actions")).toBeInTheDocument();
    });

    it("appears for an Admin viewing a non-owner member", async () => {
      // currentUser is Admin — NOT the server owner
      state.currentUser = { id: "admin-id", username: "Admin" };
      state.servers = [{ id: "server1", name: "Server", owner_id: "owner-id" }];
      state.members = [
        { user_id: "admin-id", username: "Admin", role: "Admin", avatar_url: null, status: "ONLINE" },
        { user_id: "member-id", username: "Regular", role: "Member", avatar_url: null, status: "OFFLINE" },
      ];
      state.presence = {
        "admin-id": { status: "online" },
        "member-id": { status: "offline" },
      };

      await renderPanel();

      expect(screen.getByTitle("Actions")).toBeInTheDocument();
    });

    it("does NOT appear for a regular Member viewing other members", async () => {
      state.currentUser = { id: "member1-id", username: "Member1" };
      state.servers = [{ id: "server1", name: "Server", owner_id: "owner-id" }];
      state.members = [
        { user_id: "member1-id", username: "Member1", role: "Member", avatar_url: null, status: "ONLINE" },
        { user_id: "member2-id", username: "Member2", role: "Member", avatar_url: null, status: "OFFLINE" },
      ];
      state.presence = {
        "member1-id": { status: "online" },
        "member2-id": { status: "offline" },
      };

      await renderPanel();

      expect(screen.queryByTitle("Actions")).not.toBeInTheDocument();
    });

    it("does NOT appear on the current user's own entry (self)", async () => {
      // Admin is the only non-owner member — self should never show moderation actions
      state.currentUser = { id: "admin-id", username: "Admin" };
      state.servers = [{ id: "server1", name: "Server", owner_id: "owner-id" }];
      state.members = [
        { user_id: "admin-id", username: "Admin", role: "Admin", avatar_url: null, status: "ONLINE" },
      ];
      state.presence = { "admin-id": { status: "online" } };

      await renderPanel();

      expect(screen.queryByTitle("Actions")).not.toBeInTheDocument();
    });
  });

  // ─── No server selected ───────────────────────────────────────────────────

  describe("when no server is active", () => {
    it("shows a fallback message instead of the member list", async () => {
      state.servers = [];
      state.activeServerId = null;

      render(<MembersPanel onRefresh={onRefresh} />);

      expect(screen.getByText(/No server selected/i)).toBeInTheDocument();
    });
  });
});
