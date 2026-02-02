import { NextResponse } from "next/server";

type ServerMember = { id: string; username: string };
type Server = { id: string; name: string; ownerId: string; members: ServerMember[] };

declare global {
  var __SERVERS__: Server[] | undefined;
}

function getServersStore(): Server[] {
  if (!globalThis.__SERVERS__) globalThis.__SERVERS__ = [];
  return globalThis.__SERVERS__;
}

function getCurrentUser(): ServerMember {
  return { id: "u_1", username: "zakary" };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const { serverId } = await params;
  const servers = getServersStore();
  const me = getCurrentUser();

  const idx = servers.findIndex((s) => s.id === serverId);
  if (idx === -1) return new NextResponse("Server not found", { status: 404 });

  const server = servers[idx];

  // si le créateur "leave", on laisse quand même (mock), mais en vrai tu pourrais l’interdire
  const updated: Server = {
    ...server,
    members: server.members.filter((m) => m.id !== me.id),
  };

  servers[idx] = updated;
  return NextResponse.json(updated);
}
