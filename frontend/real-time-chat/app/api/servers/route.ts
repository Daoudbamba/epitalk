import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ServerMember = { id: string; username: string };
type Server = {
  id: string;
  name: string;
  ownerId: string;
  members: ServerMember[];
};

type Channel = { id: string; serverId: string; name: string };

declare global {
  var __SERVERS__: Server[] | undefined;
  var __CHANNELS__: Channel[] | undefined;
}

function serversStore(): Server[] {
  if (!globalThis.__SERVERS__) {
    globalThis.__SERVERS__ = [
      {
        id: "srv_1",
        name: "Mon premier serveur",
        ownerId: "u_1",
        members: [{ id: "u_1", username: "zakary" }],
      },
    ];
  }
  return globalThis.__SERVERS__;
}

function channelsStore(): Channel[] {
  if (!globalThis.__CHANNELS__) {
    globalThis.__CHANNELS__ = [
      { id: "ch_1", serverId: "srv_1", name: "général" },
    ];
  }
  return globalThis.__CHANNELS__;
}

// Mock “current user”
function getCurrentUser(): ServerMember {
  return { id: "u_1", username: "zakary" };
}

export async function GET() {
  return NextResponse.json(serversStore());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();

  if (!name) {
    return new NextResponse("Missing server name", { status: 400 });
  }

  const me = getCurrentUser();

  // ✅ newServer est créé ICI
  const newServer: Server = {
    id: `srv_${Date.now()}`,
    name,
    ownerId: me.id,
    members: [me],
  };

  // Ajoute le serveur au store
  const servers = serversStore();
  globalThis.__SERVERS__ = [newServer, ...servers];

  // ✅ AJOUT : créer automatiquement le channel "général" pour ce serveur
  const channels = channelsStore();
  globalThis.__CHANNELS__ = [
    { id: `ch_${Date.now() + 1}`, serverId: newServer.id, name: "général" },
    ...channels,
  ];

  return NextResponse.json(newServer, { status: 201 });
}
