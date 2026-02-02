// app/api/_mock/db.ts
export type MockMember = {
  id: string;
  username: string;
};

export type MockServer = {
  id: string;
  name: string;
  ownerId: string;
  members: MockMember[];
};

export const mockCurrentUser: MockMember = {
  id: "me",
  username: "me",
};

// DB en mémoire (mock)
export const db = {
  servers: [] as MockServer[],
};
