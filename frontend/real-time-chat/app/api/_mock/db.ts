// frontend/real-time-chat/app/api/_mock/db.ts
export type MockMember = { id: string; username: string };

export type MockServer = {
  id: string;
  name: string;
  ownerId: string;
  members: MockMember[];
};

export type MockChannel = {
  id: string;
  serverId: string;
  name: string;
  type: "text" | "voice";
};

export type MockMessage = {
  id: string;
  serverId: string;
  channelId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
};

export type MockInvite = {
  code: string;
  serverId: string;
  createdAt: string;
};

export const mockCurrentUser: MockMember = {
  id: "u_1",
  username: "Moïse",
};

declare global {
  var __MOCK_DB__:
    | {
        servers: MockServer[];
        channels: MockChannel[];
        messages: MockMessage[];
        invites: MockInvite[];
      }
    | undefined;
}

export function getDb() {
  if (!globalThis.__MOCK_DB__) {
    globalThis.__MOCK_DB__ = {
      servers: [
        {
          id: "srv_1",
          name: "Mon premier serveur",
          ownerId: mockCurrentUser.id,
          members: [mockCurrentUser],
        },
      ],
      channels: [{ id: "ch_1", serverId: "srv_1", name: "général", type: "text" }],
      messages: [],
      invites: [],
    };
  }
  return globalThis.__MOCK_DB__!;
}
