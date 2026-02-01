import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    { id: "channel-1", name: "général" },
    { id: "channel-2", name: "annonces" },
    { id: "channel-3", name: "jeux vidéos" },
  ]);
}
