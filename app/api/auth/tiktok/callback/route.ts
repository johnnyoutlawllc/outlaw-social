import { NextRequest, NextResponse } from "next/server";
import { exchangeTikTokCode, getTikTokUserInfo } from "@/lib/tiktok";
import { createServiceClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) return NextResponse.redirect(`${appUrl}/connect?error=tiktok_denied`);
  if (!code) return NextResponse.redirect(`${appUrl}/connect?error=tiktok_no_code`);

  const cookieStore = await cookies();
  const savedState = cookieStore.get("tiktok_oauth_state")?.value;
  const codeVerifier = cookieStore.get("tiktok_code_verifier")?.value;
  if (state !== savedState || !codeVerifier) return NextResponse.redirect(`${appUrl}/connect?error=tiktok_state_mismatch`);
  cookieStore.delete("tiktok_oauth_state");
  cookieStore.delete("tiktok_code_verifier");

  try {
    const redirectUri = `${appUrl}/api/auth/tiktok/callback`;
    const tokens = await exchangeTikTokCode(code, redirectUri, codeVerifier);
    const userInfo = await getTikTokUserInfo(tokens.access_token);
    const userId = cookieStore.get("user_id")?.value;
    const db = createServiceClient();

    await db.from("social.connected_accounts").upsert({
      user_id: userId,
      platform: "tiktok",
      platform_account_id: tokens.open_id,
      display_name: userInfo?.display_name,
      avatar_url: userInfo?.avatar_url,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope?.split(",") ?? [],
      extra_data: {
        union_id: userInfo?.union_id,
        follower_count: userInfo?.follower_count,
        following_count: userInfo?.following_count,
        likes_count: userInfo?.likes_count,
        video_count: userInfo?.video_count,
        bio_description: userInfo?.bio_description,
        profile_deep_link: userInfo?.profile_deep_link,
        is_verified: userInfo?.is_verified,
      },
      is_active: true,
    }, { onConflict: "user_id,platform,platform_account_id" });

    return NextResponse.redirect(`${appUrl}/connect?success=tiktok`);
  } catch (err) {
    console.error("TikTok callback error:", err);
    return NextResponse.redirect(`${appUrl}/connect?error=tiktok_callback_failed`);
  }
}
