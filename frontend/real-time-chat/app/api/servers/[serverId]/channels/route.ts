import { NextResponse } from "next/server";

type Channel = { id: string; serverId: string; name: string };

declare global {
  var __CHANNELS__: Channel[] | undefined;
}

function store(): Channel[] {
  if (!globalThis.__CHANNELS__) {
    // seed (optionnel)
    globalThis.__CHANNELS__ = [
      { id: "ch_1", serverId: "srv_1", name: "général" },
      { id: "ch_2", serverId: "srv_1", name: "annonces" },
    ];
  }
  return globalThis.__CHANNELS__;
}

export async function GET(
  _req: Request,
  { params }: { params: { serverId: string } }
) {
  const channels = store().filter((c) => c.serverId === params.serverId);
  return NextResponse.json(channels);
}

export async function POST(
  req: Request,
  { params }: { params: { serverId: string } }
) {
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return new NextResponse("Missing channel name", { status: 400 });

  const newChannel: Channel = {
    id: `ch_${Date.now()}`,
    serverId: params.serverId,
    name,
  };

  globalThis.__CHANNELS__ = [newChannel, ...store()];
  return NextResponse.json(newChannel, { status: 201 });
}
