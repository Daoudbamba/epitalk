import { NextResponse } from "next/server";

type ServerMember = { id: string; username: string };
type Server = { id: string; name: string; ownerId: string; members: ServerMember[] };

declare global {
  // permet de partager la même RAM entre fichiers en dev (simple)
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
  { params }: { params: { serverId: string } }
) {
  const servers = getServersStore();
  const me = getCurrentUser();

  const idx = servers.findIndex((s) => s.id === params.serverId);
  if (idx === -1) return new NextResponse("Server not found", { status: 404 });

  const server = servers[idx];
  const already = server.members.some((m) => m.id === me.id);

  const updated: Server = already
    ? server
    : { ...server, members: [...server.members, me] };

  servers[idx] = updated;
  return NextResponse.json(updated);
}
