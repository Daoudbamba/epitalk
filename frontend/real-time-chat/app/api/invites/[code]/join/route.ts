import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const db = getDb();

  const invite = db.invites.find((i) => i.code === code.trim());
  if (!invite) return new NextResponse("Invite not found", { status: 404 });

  const server = db.servers.find((s) => s.id === invite.serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  const already = server.members.some((m) => m.id === mockCurrentUser.id);
  if (!already) server.members.push(mockCurrentUser);

  return NextResponse.json(server);
}
