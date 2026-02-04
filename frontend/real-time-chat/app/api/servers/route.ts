// frontend/real-time-chat/app/api/servers/route.ts
import { NextResponse } from "next/server";
import { getDb, mockCurrentUser } from "@/app/api/_mock/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  return NextResponse.json(db.servers);
}

export async function POST(req: Request) {
  const db = getDb();

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return new NextResponse("Missing server name", { status: 400 });

  const newServer = {
    id: `srv_${Date.now()}`,
    name,
    ownerId: mockCurrentUser.id,
    members: [mockCurrentUser],
  };

  db.servers.unshift(newServer);

  // ✅ channel “général” auto
  db.channels.unshift({
    id: `ch_${Date.now() + 1}`,
    serverId: newServer.id,
    name: "général",
    type: "text",
  });

  return NextResponse.json(newServer, { status: 201 });
}
