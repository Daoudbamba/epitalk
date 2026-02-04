import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const { serverId } = await params;
  const db = getDb();

  const server = db.servers.find((s) => s.id === serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  const isMember = server.members.some((m) => m.id === mockCurrentUser.id);
  if (!isMember) return new NextResponse("Forbidden", { status: 403 });

  return NextResponse.json(server.members);
}
