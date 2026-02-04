import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";

function randomCode() {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(
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

  const code = randomCode();
  db.invites.unshift({ code, serverId, createdAt: new Date().toISOString() });

  return NextResponse.json({ code, serverId });
}
