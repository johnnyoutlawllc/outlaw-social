import { NextRequest, NextResponse } from "next/server";
import { exchangeMetaCode, getLongLivedToken, getMetaUserPages, getInstagramAccountForPage, getInstagramProfile } from "@/lib/meta";
import { createServiceClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) return NextResponse.redirect(`${appUrl}/connect?error=meta_denied`);
  if (!code) return NextResponse.redirect(`${appUrl}/connect?error=meta_no_code`);

  const cookieStore = await cookies();
  const savedState = cookieStore.get("meta_oauth_state")?.value;
  if (state !== savedState) return NextResponse.redirect(`${appUrl}/connect?error=meta_state_mismatch`);
  cookieStore.delete("meta_oauth_state");

  try {
    const redirectUri = `${appUrl}/api/auth/facebook/callback`;
    const shortToken = await exchangeMetaCode(code, redirectUri);
    const longToken = await getLongLivedToken(shortToken.access_token);
    const pages = await getMetaUserPages(longToken.access_token);

    const db = createServiceClient();
    const userId = cookieStore.get("user_id")?.value; // set after Supabase auth

    for (const page of pages) {
      const expiresAt = new Date(Date.now() + (longToken.expires_in ?? 5184000) * 1000).toISOString();

      // Upsert Facebook page
      await db.from("social.connected_accounts").upsert({
        user_id: userId,
        platform: "facebook",
        platform_account_id: page.id,
        display_name: page.name,
        access_token: page.access_token,
        token_expires_at: expiresAt,
        scopes: ["pages_show_list", "pages_read_engagement", "read_insights"],
        is_active: true,
      }, { onConflict: "user_id,platform,platform_account_id" });

      // Check for linked Instagram business account
      try {
        const igAccount = await getInstagramAccountForPage(page.id, page.access_token);
        if (igAccount) {
          const igProfile = await getInstagramProfile(igAccount.id, page.access_token);
          await db.from("social.connected_accounts").upsert({
            user_id: userId,
            platform: "instagram",
            platform_account_id: igAccount.id,
            platform_username: igProfile.username,
            display_name: igProfile.name || igProfile.username,
            avatar_url: igProfile.profile_picture_url,
            access_token: page.access_token, // IG uses the page token
            token_expires_at: expiresAt,
            scopes: ["instagram_basic", "instagram_manage_insights"],
            is_active: true,
          }, { onConflict: "user_id,platform,platform_account_id" });
        }
      } catch { /* No IG account linked — skip */ }
    }

    return NextResponse.redirect(`${appUrl}/connect?success=meta`);
  } catch (err) {
    console.error("Meta callback error:", err);
    return NextResponse.redirect(`${appUrl}/connect?error=meta_callback_failed`);
  }
}
