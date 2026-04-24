// Supabase Edge Function: ingest-instagram
// Pulls IG account insights, media, and media insights for all active IG accounts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API = "https://graph.facebook.com/v21.0";

async function getIGProfile(igId: string, token: string) {
  const fields = "id,username,name,followers_count,follows_count,media_count,profile_picture_url";
  const res = await fetch(`${META_API}/${igId}?fields=${fields}&access_token=${token}`);
  if (!res.ok) throw new Error(`IG profile error: ${await res.text()}`);
  return res.json();
}

async function getIGInsights(igId: string, token: string) {
  const since = Math.floor((Date.now() - 2 * 86400_000) / 1000);
  const metrics = "impressions,reach,profile_views,follower_count";
  const res = await fetch(`${META_API}/${igId}/insights?metric=${metrics}&period=day&since=${since}&access_token=${token}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}

async function getIGMedia(igId: string, token: string) {
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  const res = await fetch(`${META_API}/${igId}/media?fields=${fields}&limit=50&access_token=${token}`);
  if (!res.ok) throw new Error(`IG media error: ${await res.text()}`);
  const data = await res.json();
  return data.data ?? [];
}

async function getIGMediaInsights(mediaId: string, token: string) {
  const metrics = "impressions,reach,likes,comments,shares,saved,plays";
  const res = await fetch(`${META_API}/${mediaId}/insights?metric=${metrics}&access_token=${token}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: accounts } = await db.schema("social").from("connected_accounts")
    .select("*").eq("platform", "instagram").eq("is_active", true);

  if (!accounts?.length) return new Response(JSON.stringify({ message: "No IG accounts" }));

  const today = new Date().toISOString().split("T")[0];
  let totalUpserted = 0;

  for (const account of accounts) {
    const startedAt = new Date().toISOString();
    try {
      const [profile, insights, media] = await Promise.all([
        getIGProfile(account.platform_account_id, account.access_token),
        getIGInsights(account.platform_account_id, account.access_token),
        getIGMedia(account.platform_account_id, account.access_token),
      ]);

      const metricsMap: Record<string, Record<string, number>> = {};
      for (const m of insights) {
        metricsMap[m.name] = {};
        for (const v of m.values ?? []) {
          const d = v.end_time?.split("T")[0];
          if (d) metricsMap[m.name][d] = Number(v.value ?? 0);
        }
      }

      await db.schema("social").from("account_snapshots").upsert({
        account_id: account.id,
        platform: "instagram",
        platform_account_id: account.platform_account_id,
        snapshot_date: today,
        followers_count: profile.followers_count,
        following_count: profile.follows_count,
        posts_count: profile.media_count,
        reach: metricsMap["reach"]?.[today] ?? null,
        impressions: metricsMap["impressions"]?.[today] ?? null,
        profile_views: metricsMap["profile_views"]?.[today] ?? null,
        synced_at: new Date().toISOString(),
      }, { onConflict: "account_id,snapshot_date" });

      // Update avatar
      await db.schema("social").from("connected_accounts").update({
        platform_username: profile.username,
        avatar_url: profile.profile_picture_url,
        last_synced_at: new Date().toISOString(),
      }).eq("id", account.id);
      totalUpserted++;

      for (const item of media) {
        const mediaInsights = await getIGMediaInsights(item.id, account.access_token);
        const im: Record<string, number> = {};
        for (const m of mediaInsights) im[m.name] = Number(m.values?.[0]?.value ?? 0);

        const { data: postRow } = await db.schema("social").from("posts").upsert({
          account_id: account.id,
          platform: "instagram",
          platform_post_id: item.id,
          post_type: item.media_type?.toLowerCase() ?? "image",
          caption: item.caption,
          media_url: item.media_url,
          thumbnail_url: item.thumbnail_url,
          permalink: item.permalink,
          posted_at: item.timestamp,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "platform,platform_post_id" }).select("id").single();

        if (postRow?.id) {
          await db.schema("social").from("post_snapshots").upsert({
            post_id: postRow.id,
            snapshot_date: today,
            likes: im["likes"] ?? 0,
            comments: im["comments"] ?? 0,
            shares: im["shares"] ?? 0,
            saves: im["saved"] ?? 0,
            views: im["plays"] ?? 0,
            impressions: im["impressions"] ?? 0,
            reach: im["reach"] ?? 0,
            synced_at: new Date().toISOString(),
          }, { onConflict: "post_id,snapshot_date" });
          totalUpserted++;
        }
      }

      await db.schema("social").from("sync_log").insert({
        account_id: account.id, platform: "instagram", job_type: "account_snapshot+media",
        status: "success", records_upserted: totalUpserted, started_at: startedAt, finished_at: new Date().toISOString(),
      });
    } catch (err) {
      await db.schema("social").from("sync_log").insert({
        account_id: account.id, platform: "instagram", job_type: "account_snapshot+media",
        status: "error", error_message: String(err), started_at: startedAt, finished_at: new Date().toISOString(),
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, upserted: totalUpserted }));
});
