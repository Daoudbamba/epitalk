import { NextResponse } from "next/server";

export async function GET() {
    
  return NextResponse.json({
    id: "fake-id-123",
    username: "fake-user",
    email: "fake@email.com",
  });
}
