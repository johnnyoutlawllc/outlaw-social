import { NextResponse } from "next/server";
import { getTikTokAuthUrl } from "@/lib/tiktok";
import { cookies } from "next/headers";

export async function GET() {
  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;
  const url = getTikTokAuthUrl(redirectUri, state, codeVerifier);

  const cookieStore = await cookies();
  cookieStore.set("tiktok_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  cookieStore.set("tiktok_code_verifier", codeVerifier, { httpOnly: true, maxAge: 600, path: "/" });

  return NextResponse.redirect(url);
}
