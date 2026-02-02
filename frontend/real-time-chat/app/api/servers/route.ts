import { NextResponse } from "next/server";

type ServerMember = { id: string; username: string };
type Server = { id: string; name: string; ownerId: string; members: ServerMember[] };

// Mémoire RAM (mock)
let SERVERS: Server[] = [
  {
    id: "srv_1",
    name: "Mon premier serveur",
    ownerId: "u_1",
    members: [{ id: "u_1", username: "zakary" }],
  },
];

// Mock “current user”
function getCurrentUser(): ServerMember {
  return { id: "u_1", username: "zakary" };
}

export async function GET() {
  return NextResponse.json(SERVERS);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();

  if (!name) {
    return new NextResponse("Missing server name", { status: 400 });
  }

  const me = getCurrentUser();

  const newServer: Server = {
    id: `srv_${Date.now()}`,
    name,
    ownerId: me.id,
    members: [me],
  };

  SERVERS = [newServer, ...SERVERS];
  return NextResponse.json(newServer, { status: 201 });
}
