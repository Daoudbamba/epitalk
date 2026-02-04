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

  const channels = db.channels.filter((c) => c.serverId === serverId);
  return NextResponse.json(channels);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const { serverId } = await params;
  const db = getDb();

  const server = db.servers.find((s) => s.id === serverId);
  if (!server) return new NextResponse("Server not found", { status: 404 });

  const isMember = server.members.some((m) => m.id === mockCurrentUser.id);
  if (!isMember) return new NextResponse("Forbidden", { status: 403 });

  const body = (await req.json().catch(() => null)) as { name?: string; type?: "text" | "voice" } | null;
  const name = body?.name?.trim();
  const type = body?.type ?? "text";
  if (!name) return new NextResponse("Missing channel name", { status: 400 });

  const channel = { id: `ch_${Date.now()}`, serverId, name, type } as const;
  db.channels.unshift(channel);

  return NextResponse.json(channel, { status: 201 });
}
