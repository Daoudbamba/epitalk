import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";
import type { MockMessage } from "@/app/api/_mock/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ serverId: string; channelId: string }> }
) {
  const { serverId, channelId } = await params;
  const db = getDb();

  const server = db.servers.find((s) => s.id === serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  // (mock) on autorise si tu es membre
  const isMember = server.members.some((m) => m.id === mockCurrentUser.id);
  if (!isMember) return new NextResponse("Forbidden", { status: 403 });

  const msgs = db.messages
    .filter((m) => m.serverId === serverId && m.channelId === channelId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return NextResponse.json(msgs);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ serverId: string; channelId: string }> }
) {
  const { serverId, channelId } = await params;
  const db = getDb();

  const server = db.servers.find((s) => s.id === serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  const isMember = server.members.some((m) => m.id === mockCurrentUser.id);
  if (!isMember) return new NextResponse("Forbidden", { status: 403 });

  const body = (await req.json().catch(() => null)) as { content?: string } | null;
  const content = body?.content?.trim();
  if (!content) return new NextResponse("Missing content", { status: 400 });

  const msg: MockMessage = {
    id: `msg_${Date.now()}`,
    serverId,
    channelId,
    userId: mockCurrentUser.id,
    username: mockCurrentUser.username,
    content,
    createdAt: new Date().toISOString(),
  };

  db.messages.push(msg);
  return NextResponse.json(msg, { status: 201 });
}
