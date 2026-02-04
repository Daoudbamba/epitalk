import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const { serverId } = await params;
  const db = getDb();

  const server = db.servers.find((s) => s.id === serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  if (server.ownerId === mockCurrentUser.id) {
    return new NextResponse("Owner cannot leave (delete instead)", { status: 400 });
  }

  server.members = server.members.filter((m) => m.id !== mockCurrentUser.id);
  return NextResponse.json(server);
}
