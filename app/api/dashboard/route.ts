import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-users";

export const dynamic = "force-dynamic";

type Platform = "facebook" | "instagram" | "tiktok";

type TrendRow = {
  platform: Platform;
  day: string;
  followers: number | string | null;
};

type PostRow = {
  id: string;
  created_time?: string;
  create_time?: string;
  title: string | null;
  image_url: string | null;
  permalink: string | null;
  likes?: number | string | null;
  comments?: number | string | null;
  shares?: number | string | null;
  saves?: number | string | null;
  views?: number | string | null;
  impressions?: number | string | null;
  engagement_score?: number | string | null;
};

const OUTLAW_DATA_URL = "https://qijclqubjdvqjsgxvkzk.supabase.co";
const OUTLAW_DATA_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpamNscXViamR2cWpzZ3h2a3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDEwNjIsImV4cCI6MjA4NjU3NzA2Mn0.E83M4qkoh7d36NBYAg4N4_1FcYJhAstgZg3zUP2NyM8";

const BIG_SKY_IDS = {
  facebook: "699530623236611",
  instagram: "17841474725151882",
  tiktok: "-000GsDSS8rBwxByREq9kOjzDS9F5pHfiHRi",
} as const;

const PLATFORM_META: Record<
  Platform,
  { label: string; handle: string; metricLabel: string }
> = {
  facebook: {
    label: "Facebook",
    handle: "Big Sky 30",
    metricLabel: "likes + comments + shares",
  },
  instagram: {
    label: "Instagram",
    handle: "@big_sky_30",
    metricLabel: "likes + comments + saves + shares",
  },
  tiktok: {
    label: "TikTok",
    handle: "@big.sky.30",
    metricLabel: "likes + comments + shares",
  },
};

const dataClient = createSupabaseClient(OUTLAW_DATA_URL, OUTLAW_DATA_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return 0;
}

async function runQuery<T>(sql: string) {
  const { data, error } = await dataClient.rpc("execute_explorer_query", {
    p_sql: sql,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as T[];
}

export async function GET() {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const trendSql = `
      with fb as (
        select date(synced_at) as day, max(followers_count) as followers
        from outlaw_data.facebook_page_history
        where page_id = '${BIG_SKY_IDS.facebook}'
        group by 1
      ), ig as (
        select date(updated) as day, max(followers_count) as followers
        from outlaw_data.instagram_account_history
        where account_id = '${BIG_SKY_IDS.instagram}'
        group by 1
      ), tk_history as (
        select date(synced_at) as day, max(follower_count) as followers
        from outlaw_data.tiktok_account_history
        where open_id = '${BIG_SKY_IDS.tiktok}'
        group by 1
      ), tk as (
        select * from tk_history
        union all
        select date(last_synced_at) as day, follower_count as followers
        from outlaw_data.tiktok_accounts
        where open_id = '${BIG_SKY_IDS.tiktok}'
          and not exists (select 1 from tk_history)
      )
      select 'facebook' as platform, day, followers from fb
      union all
      select 'instagram' as platform, day, followers from ig
      union all
      select 'tiktok' as platform, day, followers from tk
      order by day asc, platform asc
    `;

    const facebookTopPostsSql = `
      with metric_rollup as (
        select
          post_id,
          max(case when metric_name = 'post_activity_by_action_type.like' then metric_value end) as likes,
          max(case when metric_name = 'post_activity_by_action_type.comment' then metric_value end) as comments,
          max(case when metric_name = 'post_activity_by_action_type.share' then metric_value end) as shares,
          max(case when metric_name = 'post_impressions_unique' then metric_value end) as impressions,
          max(case when metric_name = 'post_video_views' then metric_value end) as views
        from outlaw_data.facebook_post_metrics
        where account_id = '${BIG_SKY_IDS.facebook}'
        group by post_id
      )
      select
        fp.post_id as id,
        fp.created_time,
        left(coalesce(fp.message, ''), 160) as title,
        fp.full_picture as image_url,
        null::text as permalink,
        coalesce(m.likes, 0) as likes,
        coalesce(m.comments, 0) as comments,
        coalesce(m.shares, 0) as shares,
        coalesce(m.views, 0) as views,
        coalesce(m.impressions, 0) as impressions,
        coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.shares, 0) as engagement_score
      from outlaw_data.facebook_posts fp
      left join metric_rollup m on m.post_id = fp.post_id
      where fp.account_id = '${BIG_SKY_IDS.facebook}'
      order by engagement_score desc, views desc, created_time desc
      limit 3
    `;

    const instagramTopPostsSql = `
      with metric_rollup as (
        select
          imi.media_id,
          max(case when metric = 'likes' then value end) as likes,
          max(case when metric = 'comments' then value end) as comments,
          max(case when metric = 'saved' then value end) as saves,
          max(case when metric = 'shares' then value end) as shares
        from outlaw_data.instagram_media_insights imi
        join outlaw_data.instagram_media im on im.media_id = imi.media_id
        where im.account_id = '${BIG_SKY_IDS.instagram}'
        group by imi.media_id
      )
      select
        im.media_id as id,
        im.timestamp as created_time,
        left(coalesce(im.caption, ''), 160) as title,
        coalesce(im.media_url, im.thumbnail_url) as image_url,
        im.permalink,
        coalesce(m.likes, 0) as likes,
        coalesce(m.comments, 0) as comments,
        coalesce(m.saves, 0) as saves,
        coalesce(m.shares, 0) as shares,
        coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.saves, 0) + coalesce(m.shares, 0) as engagement_score
      from outlaw_data.instagram_media im
      left join metric_rollup m on m.media_id = im.media_id
      where im.account_id = '${BIG_SKY_IDS.instagram}'
      order by engagement_score desc, created_time desc
      limit 3
    `;

    const tiktokTopPostsSql = `
      with latest_snapshots as (
        select distinct on (video_id)
          video_id,
          view_count,
          like_count,
          comment_count,
          share_count,
          snapshot_timestamp
        from outlaw_data.tiktok_video_snapshots
        order by video_id, snapshot_timestamp desc
      )
      select
        tv.video_id as id,
        tv.create_time,
        left(coalesce(tv.title, tv.video_description, ''), 160) as title,
        tv.cover_image_url as image_url,
        tv.share_url as permalink,
        coalesce(ls.like_count, 0) as likes,
        coalesce(ls.comment_count, 0) as comments,
        coalesce(ls.share_count, 0) as shares,
        coalesce(ls.view_count, 0) as views,
        coalesce(ls.like_count, 0) + coalesce(ls.comment_count, 0) + coalesce(ls.share_count, 0) as engagement_score
      from outlaw_data.tiktok_videos tv
      left join latest_snapshots ls on ls.video_id = tv.video_id
      where tv.account_open_id = '${BIG_SKY_IDS.tiktok}'
      order by engagement_score desc, views desc, create_time desc
      limit 3
    `;

    const [trendRows, facebookRows, instagramRows, tiktokRows] =
      await Promise.all([
        runQuery<TrendRow>(trendSql),
        runQuery<PostRow>(facebookTopPostsSql),
        runQuery<PostRow>(instagramTopPostsSql),
        runQuery<PostRow>(tiktokTopPostsSql),
      ]);

    const trendMap = new Map<
      string,
      { day: string; facebook: number | null; instagram: number | null; tiktok: number | null }
    >();

    for (const row of trendRows) {
      const existing = trendMap.get(row.day) ?? {
        day: row.day,
        facebook: null,
        instagram: null,
        tiktok: null,
      };

      existing[row.platform] = toNumber(row.followers);
      trendMap.set(row.day, existing);
    }

    const trend = Array.from(trendMap.values()).sort((a, b) =>
      a.day.localeCompare(b.day)
    );

    const summaries = (Object.keys(PLATFORM_META) as Platform[]).map(
      (platform) => {
        const points = trendRows
          .filter((row) => row.platform === platform)
          .sort((a, b) => a.day.localeCompare(b.day));
        const firstFollowers = points.length > 0 ? toNumber(points[0].followers) : 0;
        const latestFollowers =
          points.length > 0 ? toNumber(points[points.length - 1].followers) : 0;

        return {
          platform,
          label: PLATFORM_META[platform].label,
          handle: PLATFORM_META[platform].handle,
          metricLabel: PLATFORM_META[platform].metricLabel,
          latestFollowers,
          deltaFollowers: latestFollowers - firstFollowers,
          points: points.length,
        };
      }
    );

    const normalizePost = (row: PostRow) => ({
      id: row.id,
      createdAt: row.created_time ?? row.create_time ?? null,
      title: row.title ?? "Untitled post",
      imageUrl: row.image_url,
      permalink: row.permalink,
      likes: toNumber(row.likes),
      comments: toNumber(row.comments),
      shares: toNumber(row.shares),
      saves: toNumber(row.saves),
      views: toNumber(row.views),
      impressions: toNumber(row.impressions),
      engagementScore: toNumber(row.engagement_score),
    });

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        trend,
        summaries,
        topPosts: {
          facebook: facebookRows.map(normalizePost),
          instagram: instagramRows.map(normalizePost),
          tiktok: tiktokRows.map(normalizePost),
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
