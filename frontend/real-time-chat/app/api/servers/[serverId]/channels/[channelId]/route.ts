import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ serverId: string; channelId: string }> }
) {
  const { serverId, channelId } = await params;
  const db = getDb();

  const server = db.servers.find((s) => s.id === serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  if (server.ownerId !== mockCurrentUser.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const before = db.channels.length;
  db.channels = db.channels.filter((c) => !(c.serverId === serverId && c.id === channelId));

  if (db.channels.length === before) {
    return new NextResponse("Channel not found", { status: 404 });
  }

  db.messages = db.messages.filter((m) => m.channelId !== channelId);

  return new NextResponse(null, { status: 204 });
}
