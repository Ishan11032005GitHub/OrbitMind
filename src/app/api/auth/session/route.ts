import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json(user ? { authenticated: true, user: { id: user.id, email: user.email, name: user.displayName, avatarUrl: user.pictureUrl } } : { authenticated: false, user: null });
}
