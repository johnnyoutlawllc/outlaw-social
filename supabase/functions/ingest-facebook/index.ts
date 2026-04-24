// Supabase Edge Function: ingest-facebook
// Runs twice daily via pg_cron. Pulls page insights for all active FB accounts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API = "https://graph.facebook.com/v21.0";

async function fetchPageInsights(pageId: string, accessToken: string) {
  const since = Math.floor((Date.now() - 2 * 86400_000) / 1000);
  const metrics = [
    "page_fans",
    "page_follows",
    "page_impressions_unique",
    "page_impressions",
    "page_views_total",
    "page_post_engagements",
  ].join(",");

  const url = `${META_API}/${pageId}/insights?metric=${metrics}&period=day&since=${since}&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FB insights error: ${await res.text()}`);
  const data = await res.json();
  return data.data ?? [];
}

async function fetchPageInfo(pageId: string, accessToken: string) {
  const fields = "id,name,fan_count,followers_count,category";
  const res = await fetch(`${META_API}/${pageId}?fields=${fields}&access_token=${accessToken}`);
  if (!res.ok) throw new Error(`FB page info error: ${await res.text()}`);
  return res.json();
}

async function fetchRecentPosts(pageId: string, accessToken: string) {
  const fields = "id,message,created_time,full_picture,attachments{type}";
  const res = await fetch(`${META_API}/${pageId}/posts?fields=${fields}&limit=50&access_token=${accessToken}`);
  if (!res.ok) throw new Error(`FB posts error: ${await res.text()}`);
  const data = await res.json();
  return data.data ?? [];
}

async function fetchPostInsights(postId: string, accessToken: string) {
  const metrics = "post_impressions,post_impressions_unique,post_engaged_users,post_reactions_like_total,post_clicks";
  const res = await fetch(`${META_API}/${postId}/insights?metric=${metrics}&access_token=${accessToken}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.data ?? [];
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: accounts, error } = await db
    .schema("social")
    .from("connected_accounts")
    .select("*")
    .eq("platform", "facebook")
    .eq("is_active", true);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!accounts?.length) return new Response(JSON.stringify({ message: "No FB accounts" }));

  const today = new Date().toISOString().split("T")[0];
  let totalUpserted = 0;

  for (const account of accounts) {
    const startedAt = new Date().toISOString();
    try {
      const [pageInfo, insights, posts] = await Promise.all([
        fetchPageInfo(account.platform_account_id, account.access_token),
        fetchPageInsights(account.platform_account_id, account.access_token),
        fetchRecentPosts(account.platform_account_id, account.access_token),
      ]);

      // Parse insights into a flat map: metric -> { date -> value }
      const metricsMap: Record<string, Record<string, number>> = {};
      for (const metric of insights) {
        metricsMap[metric.name] = {};
        for (const val of metric.values ?? []) {
          const d = val.end_time?.split("T")[0];
          if (d) metricsMap[metric.name][d] = Number(val.value ?? 0);
        }
      }

      // Upsert account snapshot for today
      await db.schema("social").from("account_snapshots").upsert({
        account_id: account.id,
        platform: "facebook",
        platform_account_id: account.platform_account_id,
        snapshot_date: today,
        followers_count: pageInfo.followers_count ?? pageInfo.fan_count,
        fan_count: pageInfo.fan_count,
        reach: metricsMap["page_impressions_unique"]?.[today] ?? null,
        impressions: metricsMap["page_impressions"]?.[today] ?? null,
        profile_views: metricsMap["page_views_total"]?.[today] ?? null,
        synced_at: new Date().toISOString(),
      }, { onConflict: "account_id,snapshot_date" });
      totalUpserted++;

      // Upsert posts + post snapshots
      for (const post of posts) {
        const postInsights = await fetchPostInsights(post.id, account.access_token);
        const insightsMap: Record<string, number> = {};
        for (const m of postInsights ?? []) {
          insightsMap[m.name] = Number(m.values?.[0]?.value ?? 0);
        }

        const { data: postRow } = await db.schema("social").from("posts").upsert({
          account_id: account.id,
          platform: "facebook",
          platform_post_id: post.id,
          post_type: "post",
          caption: post.message,
          media_url: post.full_picture,
          posted_at: post.created_time,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "platform,platform_post_id" }).select("id").single();

        if (postRow?.id) {
          await db.schema("social").from("post_snapshots").upsert({
            post_id: postRow.id,
            snapshot_date: today,
            likes: insightsMap["post_reactions_like_total"] ?? 0,
            impressions: insightsMap["post_impressions"] ?? 0,
            reach: insightsMap["post_impressions_unique"] ?? 0,
            synced_at: new Date().toISOString(),
          }, { onConflict: "post_id,snapshot_date" });
          totalUpserted++;
        }
      }

      // Update last_synced_at
      await db.schema("social").from("connected_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", account.id);

      await db.schema("social").from("sync_log").insert({
        account_id: account.id, platform: "facebook", job_type: "account_snapshot+posts",
        status: "success", records_upserted: totalUpserted, started_at: startedAt, finished_at: new Date().toISOString(),
      });
    } catch (err) {
      await db.schema("social").from("sync_log").insert({
        account_id: account.id, platform: "facebook", job_type: "account_snapshot+posts",
        status: "error", error_message: String(err), started_at: startedAt, finished_at: new Date().toISOString(),
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, upserted: totalUpserted }));
});
