import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ serverId: string; memberId: string }> }
) {
  const { serverId, memberId } = await params;
  const db = getDb();

  const server = db.servers.find((s) => s.id === serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  // owner only
  if (server.ownerId !== mockCurrentUser.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ne pas kick l'owner
  if (memberId === server.ownerId) {
    return new NextResponse("Cannot kick owner", { status: 400 });
  }

  const before = server.members.length;
  server.members = server.members.filter((m) => m.id !== memberId);

  if (server.members.length === before) {
    return new NextResponse("Member not found", { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
