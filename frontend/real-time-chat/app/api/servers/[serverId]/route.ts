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

export async function DELETE(
  _req: Request,
  { params }: { params: { serverId: string } }
) {
  const servers = getServersStore();
  const before = servers.length;
  globalThis.__SERVERS__ = servers.filter((s) => s.id !== params.serverId);

  if (globalThis.__SERVERS__?.length === before) {
    return new NextResponse("Server not found", { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
