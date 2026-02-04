// frontend/real-time-chat/app/api/servers/[serverId]/route.ts
import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const { serverId } = await params;
  const db = getDb();

  const server = db.servers.find((s) => s.id === serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  if (server.ownerId !== mockCurrentUser.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  db.servers = db.servers.filter((s) => s.id !== serverId);
  db.channels = db.channels.filter((c) => c.serverId !== serverId);
  db.messages = db.messages.filter((m) => m.serverId !== serverId);
  db.invites = db.invites.filter((i) => i.serverId !== serverId);

  return new NextResponse(null, { status: 204 });
}
