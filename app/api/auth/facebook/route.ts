import { NextResponse } from "next/server";
import { getMetaAuthUrl } from "@/lib/meta";
import { cookies } from "next/headers";

export async function GET() {
  const state = crypto.randomUUID();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;
  const url = getMetaAuthUrl(redirectUri, state);

  const cookieStore = await cookies();
  cookieStore.set("meta_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });

  return NextResponse.redirect(url);
}
