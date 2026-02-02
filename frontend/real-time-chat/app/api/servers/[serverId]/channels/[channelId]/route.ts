import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Channel = { id: string; serverId: string; name: string };

declare global {
  var __CHANNELS__: Channel[] | undefined;
}

function store(): Channel[] {
  if (!globalThis.__CHANNELS__) globalThis.__CHANNELS__ = [];
  return globalThis.__CHANNELS__;
}

export async function DELETE(
  _req: Request,
  { params }: { params: { serverId: string; channelId: string } }
) {
  const channels = store();
  const idx = channels.findIndex(
    (c) => c.serverId === params.serverId && c.id === params.channelId
  );

  if (idx === -1) {
    return new NextResponse("Channel not found", { status: 404 });
  }

  const deleted = channels[idx];
  channels.splice(idx, 1);
  globalThis.__CHANNELS__ = channels;

  // ✅ on renvoie JSON (plus fiable que 204)
  return NextResponse.json(deleted, { status: 200 });
}
