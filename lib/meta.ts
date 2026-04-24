// Meta Graph API helpers (Facebook + Instagram share the same OAuth)

const META_API = "https://graph.facebook.com/v21.0";

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
].join(",");

export function getMetaAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    scope: META_SCOPES,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

export async function exchangeMetaCode(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${META_API}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error(`Meta token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in?: number }>;
}

export async function getLongLivedToken(shortToken: string) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${META_API}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error(`Long-lived token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getMetaUserPages(accessToken: string) {
  const res = await fetch(`${META_API}/me/accounts?fields=id,name,category,access_token,followers_count&access_token=${accessToken}`);
  if (!res.ok) throw new Error(`Failed to fetch pages: ${await res.text()}`);
  const data = await res.json();
  return data.data as Array<{ id: string; name: string; category: string; access_token: string; followers_count?: number }>;
}

export async function getInstagramAccountForPage(pageId: string, pageToken: string) {
  const res = await fetch(`${META_API}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
  if (!res.ok) throw new Error(`Failed to get IG account for page: ${await res.text()}`);
  const data = await res.json();
  return data.instagram_business_account as { id: string } | undefined;
}

export async function getInstagramProfile(igUserId: string, accessToken: string) {
  const fields = "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website";
  const res = await fetch(`${META_API}/${igUserId}?fields=${fields}&access_token=${accessToken}`);
  if (!res.ok) throw new Error(`Failed to get IG profile: ${await res.text()}`);
  return res.json();
}
