// Supabase Edge Function: ingest-tiktok
// Pulls TikTok user info, video list, and video stats for all active TikTok accounts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TT_API = "https://open.tiktokapis.com/v2";

async function refreshToken(refreshToken: string, clientKey: string, clientSecret: string) {
  const res = await fetch(`${TT_API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`TT refresh failed: ${await res.text()}`);
  return res.json();
}

async function getTTUserInfo(token: string) {
  const fields = "open_id,display_name,avatar_url,bio_description,is_verified,follower_count,following_count,likes_count,video_count,profile_deep_link";
  const res = await fetch(`${TT_API}/user/info/?fields=${fields}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TT user info failed: ${await res.text()}`);
  const data = await res.json();
  return data.data?.user;
}

async function getTTVideos(token: string) {
  const fields = "id,title,video_description,create_time,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count";
  const res = await fetch(`${TT_API}/video/list/?fields=${fields}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ max_count: 20 }),
  });
  if (!res.ok) throw new Error(`TT video list failed: ${await res.text()}`);
  const data = await res.json();
  return data.data?.videos ?? [];
}

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: accounts } = await db.schema("social").from("connected_accounts")
    .select("*").eq("platform", "tiktok").eq("is_active", true);

  if (!accounts?.length) return new Response(JSON.stringify({ message: "No TikTok accounts" }));

  const today = new Date().toISOString().split("T")[0];
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")!;
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
  let totalUpserted = 0;

  for (const account of accounts) {
    const startedAt = new Date().toISOString();
    try {
      let token = account.access_token;

      // Refresh token if expiring within 1 hour
      if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now() + 3600_000) {
        const refreshed = await refreshToken(account.refresh_token, clientKey, clientSecret);
        token = refreshed.access_token;
        await db.schema("social").from("connected_accounts").update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? account.refresh_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq("id", account.id);
      }

      const [userInfo, videos] = await Promise.all([
        getTTUserInfo(token),
        getTTVideos(token),
      ]);

      await db.schema("social").from("account_snapshots").upsert({
        account_id: account.id,
        platform: "tiktok",
        platform_account_id: account.platform_account_id,
        snapshot_date: today,
        followers_count: userInfo?.follower_count,
        following_count: userInfo?.following_count,
        posts_count: userInfo?.video_count,
        likes_count: userInfo?.likes_count,
        synced_at: new Date().toISOString(),
      }, { onConflict: "account_id,snapshot_date" });

      await db.schema("social").from("connected_accounts").update({
        display_name: userInfo?.display_name,
        avatar_url: userInfo?.avatar_url,
        last_synced_at: new Date().toISOString(),
        extra_data: {
          bio_description: userInfo?.bio_description,
          is_verified: userInfo?.is_verified,
          profile_deep_link: userInfo?.profile_deep_link,
        },
      }).eq("id", account.id);
      totalUpserted++;

      for (const video of videos) {
        const { data: postRow } = await db.schema("social").from("posts").upsert({
          account_id: account.id,
          platform: "tiktok",
          platform_post_id: video.id,
          post_type: "video",
          caption: video.video_description || video.title,
          thumbnail_url: video.cover_image_url,
          permalink: video.share_url,
          posted_at: video.create_time ? new Date(video.create_time * 1000).toISOString() : null,
          duration_seconds: video.duration,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "platform,platform_post_id" }).select("id").single();

        if (postRow?.id) {
          await db.schema("social").from("post_snapshots").upsert({
            post_id: postRow.id,
            snapshot_date: today,
            likes: video.like_count ?? 0,
            comments: video.comment_count ?? 0,
            shares: video.share_count ?? 0,
            views: video.view_count ?? 0,
            synced_at: new Date().toISOString(),
          }, { onConflict: "post_id,snapshot_date" });
          totalUpserted++;
        }
      }

      await db.schema("social").from("sync_log").insert({
        account_id: account.id, platform: "tiktok", job_type: "account_snapshot+videos",
        status: "success", records_upserted: totalUpserted, started_at: startedAt, finished_at: new Date().toISOString(),
      });
    } catch (err) {
      await db.schema("social").from("sync_log").insert({
        account_id: account.id, platform: "tiktok", job_type: "account_snapshot+videos",
        status: "error", error_message: String(err), started_at: startedAt, finished_at: new Date().toISOString(),
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, upserted: totalUpserted }));
});
