import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      id: "server-1",
      name: "Mon premier serveur",
    },
    {
      id: "server-2",
      name: "Projet Epitech",
    },
    {
      id: "server-3",
      name: "Serveur privé",
    },
    {
      id: "server-4",
      name: "Serveur test",
    },
  ]);
}
