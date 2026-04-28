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

type DailyMetricRow = {
  day: string;
  [key: string]: number | string | null;
};

type TopPostRow = {
  id: string;
  activity_day?: string | null;
  created_time?: string;
  create_time?: string;
  title: string | null;
  image_url: string | null;
  media_type?: string | null;
  permalink: string | null;
  likes?: number | string | null;
  comments?: number | string | null;
  shares?: number | string | null;
  saves?: number | string | null;
  views?: number | string | null;
  impressions?: number | string | null;
  engagement_score?: number | string | null;
};

type SummaryRow = {
  posts_30d?: number | string | null;
  avg_engagement?: number | string | null;
  avg_impressions?: number | string | null;
  avg_views?: number | string | null;
  total_shares?: number | string | null;
  best_engagement?: number | string | null;
  avg_shares?: number | string | null;
  avg_saves?: number | string | null;
  avg_duration?: number | string | null;
  best_views?: number | string | null;
};

type InstagramMixRow = {
  media_type: string;
  posts: number | string | null;
  avg_engagement: number | string | null;
  avg_shares: number | string | null;
  avg_saves: number | string | null;
};

type ReactionRow = {
  reaction: string;
  value: number | string | null;
};

type DemographicRow = {
  breakdown_type: string;
  key: string;
  value: number | string | null;
};

type TikTokAccountRow = {
  follower_count: number | string | null;
  following_count: number | string | null;
  likes_count: number | string | null;
  video_count: number | string | null;
  is_verified: boolean | null;
};

type DataPoint = {
  day: string;
  value: number;
};

type SocialAccountKey = "big-sky-30" | "dead-wax";

type SocialAccount = {
  key: SocialAccountKey;
  label: string;
  ids: Record<Platform, string>;
  handles: Record<Platform, string>;
};

const OUTLAW_DATA_URL = "https://qijclqubjdvqjsgxvkzk.supabase.co";
const OUTLAW_DATA_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpamNscXViamR2cWpzZ3h2a3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDEwNjIsImV4cCI6MjA4NjU3NzA2Mn0.E83M4qkoh7d36NBYAg4N4_1FcYJhAstgZg3zUP2NyM8";

const SOCIAL_ACCOUNTS: SocialAccount[] = [
  {
    key: "big-sky-30",
    label: "Big Sky 30",
    ids: {
      facebook: "699530623236611",
      instagram: "17841474725151882",
      tiktok: "-000GsDSS8rBwxByREq9kOjzDS9F5pHfiHRi",
    },
    handles: {
      facebook: "Big Sky 30",
      instagram: "@big_sky_30",
      tiktok: "@big.sky.30",
    },
  },
  {
    key: "dead-wax",
    label: "Dead Wax",
    ids: {
      facebook: "410101409034930",
      instagram: "17841401222920324",
      tiktok: "-000Z8c_S35oIniQhkul_S6J-BvbmJAG02XS",
    },
    handles: {
      facebook: "Dead Wax Records",
      instagram: "@dead_wax_dallas",
      tiktok: "@deadwaxdallas",
    },
  },
];

const PLATFORM_META: Record<
  Platform,
  {
    label: string;
    handle: string;
    metricLabel: string;
    performanceLabel: string;
    performanceNote: string;
  }
> = {
  facebook: {
    label: "Facebook",
    handle: "Big Sky 30",
    metricLabel: "likes + comments + shares",
    performanceLabel: "Daily reach",
    performanceNote: "From page impressions unique",
  },
  instagram: {
    label: "Instagram",
    handle: "@big_sky_30",
    metricLabel: "likes + comments + saves + shares",
    performanceLabel: "Daily reach",
    performanceNote: "From Instagram account insights",
  },
  tiktok: {
    label: "TikTok",
    handle: "@big.sky.30",
    metricLabel: "likes + comments + shares",
    performanceLabel: "Daily views",
    performanceNote: "Derived from video snapshot deltas",
  },
};

function platformMetaFor(account: SocialAccount) {
  return {
    facebook: { ...PLATFORM_META.facebook, handle: account.handles.facebook },
    instagram: { ...PLATFORM_META.instagram, handle: account.handles.instagram },
    tiktok: { ...PLATFORM_META.tiktok, handle: account.handles.tiktok },
  } satisfies typeof PLATFORM_META;
}

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

function buildDataPoints(rows: DailyMetricRow[], field: string) {
  return rows.map((row) => ({
    day: row.day,
    value: toNumber(row[field]),
  }));
}

function getLatestPoint(points: DataPoint[]) {
  return points.length > 0 ? points[points.length - 1] : null;
}

function getPointDelta(points: DataPoint[]) {
  if (points.length < 2) return 0;
  return points[points.length - 1].value - points[points.length - 2].value;
}

function getBestPoint(points: DataPoint[]) {
  return points.reduce<DataPoint | null>((best, point) => {
    if (!best || point.value > best.value) return point;
    return best;
  }, null);
}

function normalizePost(row: TopPostRow) {
  return {
    id: row.id,
    createdAt: row.created_time ?? row.create_time ?? null,
    title: row.title ?? "Untitled post",
    imageUrl: row.image_url,
    mediaType: row.media_type ?? null,
    permalink: row.permalink,
    likes: toNumber(row.likes),
    comments: toNumber(row.comments),
    shares: toNumber(row.shares),
    saves: toNumber(row.saves),
    views: toNumber(row.views),
    impressions: toNumber(row.impressions),
    engagementScore: toNumber(row.engagement_score),
  };
}

function buildActivityDrivers(rows: TopPostRow[]) {
  const grouped = new Map<string, ReturnType<typeof normalizePost>[]>();

  for (const row of rows) {
    const day = row.activity_day ?? row.created_time?.slice(0, 10) ?? row.create_time?.slice(0, 10);
    if (!day) continue;

    const existing = grouped.get(day) ?? [];
    existing.push(normalizePost(row));
    grouped.set(day, existing);
  }

  return Object.fromEntries(
    Array.from(grouped.entries()).map(([day, posts]) => [
      day,
      posts
        .sort((a, b) => {
          if (b.engagementScore !== a.engagementScore) {
            return b.engagementScore - a.engagementScore;
          }
          return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
        })
        .slice(0, 5),
    ])
  );
}

export async function GET(request: Request) {
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

  const requestedAccount = new URL(request.url).searchParams.get("account") as SocialAccountKey | null;
  const account = SOCIAL_ACCOUNTS.find((item) => item.key === requestedAccount) ?? SOCIAL_ACCOUNTS[0];
  const accountIds = account.ids;
  const platformMeta = platformMetaFor(account);

  try {
    const followerTrendSql = `
      with fb as (
        select date(synced_at) as day, max(followers_count) as followers
        from outlaw_data.facebook_page_history
        where page_id = '${accountIds.facebook}'
        group by 1
      ), ig as (
        select date(updated) as day, max(followers_count) as followers
        from outlaw_data.instagram_account_history
        where account_id = '${accountIds.instagram}'
        group by 1
      ), tk_history as (
        select date(synced_at) as day, max(follower_count) as followers
        from outlaw_data.tiktok_account_history
        where open_id = '${accountIds.tiktok}'
        group by 1
      ), tk as (
        select * from tk_history
        union all
        select date(last_synced_at) as day, follower_count as followers
        from outlaw_data.tiktok_accounts
        where open_id = '${accountIds.tiktok}'
          and not exists (select 1 from tk_history)
      )
      select 'facebook' as platform, day, followers from fb
      union all
      select 'instagram' as platform, day, followers from ig
      union all
      select 'tiktok' as platform, day, followers from tk
      order by day asc, platform asc
    `;

    const facebookPerformanceSql = `
      select
        metric_date as day,
        max(case when metric_name = 'page_impressions_unique' then metric_value end) as reach,
        max(case when metric_name = 'page_video_views' then metric_value end) as video_views,
        max(case when metric_name = 'page_views_total' then metric_value end) as page_views,
        sum(case when metric_name like 'page_actions_post_reactions_total.%' then metric_value else 0 end) as reactions
      from outlaw_data.facebook_page_insights
      where account_id = '${accountIds.facebook}'
      group by 1
      order by 1
    `;

    const facebookRecentSql = `
      with metric_rollup as (
        select
          post_id,
          max(case when metric_name = 'post_activity_by_action_type.like' then metric_value end) as likes,
          max(case when metric_name = 'post_activity_by_action_type.comment' then metric_value end) as comments,
          max(case when metric_name = 'post_activity_by_action_type.share' then metric_value end) as shares,
          max(case when metric_name = 'post_impressions_unique' then metric_value end) as impressions,
          max(case when metric_name = 'post_video_views' then metric_value end) as views
        from outlaw_data.facebook_post_metrics
        where account_id = '${accountIds.facebook}'
        group by post_id
      ), recent as (
        select
          fp.post_id,
          fp.created_time,
          coalesce(m.likes, 0) as likes,
          coalesce(m.comments, 0) as comments,
          coalesce(m.shares, 0) as shares,
          coalesce(m.impressions, 0) as impressions,
          coalesce(m.views, 0) as views,
          coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.shares, 0) as engagement
        from outlaw_data.facebook_posts fp
        left join metric_rollup m on m.post_id = fp.post_id
        where fp.account_id = '${accountIds.facebook}'
          and fp.created_time >= now() - interval '30 days'
      )
      select
        count(*) as posts_30d,
        avg(engagement) as avg_engagement,
        avg(impressions) as avg_impressions,
        avg(views) as avg_views,
        sum(shares) as total_shares,
        max(engagement) as best_engagement
      from recent
    `;

    const facebookReactionSql = `
      with latest_day as (
        select max(metric_date) as day
        from outlaw_data.facebook_page_insights
        where account_id = '${accountIds.facebook}'
      )
      select
        replace(metric_name, 'page_actions_post_reactions_total.', '') as reaction,
        metric_value as value
      from outlaw_data.facebook_page_insights
      where account_id = '${accountIds.facebook}'
        and metric_date = (select day from latest_day)
        and metric_name like 'page_actions_post_reactions_total.%'
      order by metric_value desc
      limit 5
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
        where account_id = '${accountIds.facebook}'
        group by post_id
      )
      select
        fp.post_id as id,
        fp.created_time,
        left(coalesce(fp.message, ''), 160) as title,
        fp.full_picture as image_url,
        null::text as media_type,
        null::text as permalink,
        coalesce(m.likes, 0) as likes,
        coalesce(m.comments, 0) as comments,
        coalesce(m.shares, 0) as shares,
        coalesce(m.views, 0) as views,
        coalesce(m.impressions, 0) as impressions,
        coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.shares, 0) as engagement_score
      from outlaw_data.facebook_posts fp
      left join metric_rollup m on m.post_id = fp.post_id
      where fp.account_id = '${accountIds.facebook}'
      order by engagement_score desc, views desc, created_time desc
    `;

    const facebookReachDriversSql = `
      with post_daily as (
        select
          fpm.post_id,
          fpm.metric_date as activity_day,
          date(fp.created_time) as created_day,
          max(case when fpm.metric_name = 'post_impressions_unique' then fpm.metric_value end) as reach,
          max(case when fpm.metric_name = 'post_activity_by_action_type.like' then fpm.metric_value end) as likes,
          max(case when fpm.metric_name = 'post_activity_by_action_type.comment' then fpm.metric_value end) as comments,
          max(case when fpm.metric_name = 'post_activity_by_action_type.share' then fpm.metric_value end) as shares
        from outlaw_data.facebook_post_metrics fpm
        join outlaw_data.facebook_posts fp on fp.post_id = fpm.post_id
        where fpm.account_id = '${accountIds.facebook}'
          and fp.account_id = '${accountIds.facebook}'
        group by 1, 2, 3
      ), lagged as (
        select
          post_id,
          activity_day,
          created_day,
          reach,
          likes,
          comments,
          shares,
          lag(reach) over(partition by post_id order by activity_day) as prev_reach,
          lag(likes) over(partition by post_id order by activity_day) as prev_likes,
          lag(comments) over(partition by post_id order by activity_day) as prev_comments,
          lag(shares) over(partition by post_id order by activity_day) as prev_shares
        from post_daily
      ), deltas as (
        select
          post_id,
          activity_day,
          case when prev_reach is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(reach, 0) - coalesce(prev_reach, 0), 0) end as daily_reach,
          case when prev_likes is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(likes, 0) - coalesce(prev_likes, 0), 0) end as daily_likes,
          case when prev_comments is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(comments, 0) - coalesce(prev_comments, 0), 0) end as daily_comments,
          case when prev_shares is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(shares, 0) - coalesce(prev_shares, 0), 0) end as daily_shares
        from lagged
      )
      select
        d.activity_day,
        fp.post_id as id,
        fp.created_time,
        left(coalesce(fp.message, ''), 160) as title,
        fp.full_picture as image_url,
        null::text as media_type,
        null::text as permalink,
        coalesce(d.daily_likes, 0) as likes,
        coalesce(d.daily_comments, 0) as comments,
        coalesce(d.daily_shares, 0) as shares,
        0 as saves,
        0 as views,
        coalesce(d.daily_reach, 0) as impressions,
        coalesce(d.daily_reach, 0) as engagement_score
      from deltas d
      join outlaw_data.facebook_posts fp on fp.post_id = d.post_id
      where fp.account_id = '${accountIds.facebook}'
        and d.activity_day >= current_date - interval '180 days'
        and coalesce(d.daily_reach, 0) > 0
      order by d.activity_day desc, engagement_score desc, created_time desc
    `;

    const facebookReactionDriversSql = `
      with post_daily as (
        select
          fpm.post_id,
          fpm.metric_date as activity_day,
          date(fp.created_time) as created_day,
          max(case when fpm.metric_name = 'post_impressions_unique' then fpm.metric_value end) as reach,
          max(case when fpm.metric_name = 'post_activity_by_action_type.like' then fpm.metric_value end) as likes,
          max(case when fpm.metric_name = 'post_activity_by_action_type.comment' then fpm.metric_value end) as comments,
          max(case when fpm.metric_name = 'post_activity_by_action_type.share' then fpm.metric_value end) as shares
        from outlaw_data.facebook_post_metrics fpm
        join outlaw_data.facebook_posts fp on fp.post_id = fpm.post_id
        where fpm.account_id = '${accountIds.facebook}'
          and fp.account_id = '${accountIds.facebook}'
        group by 1, 2, 3
      ), lagged as (
        select
          post_id,
          activity_day,
          created_day,
          reach,
          likes,
          comments,
          shares,
          lag(reach) over(partition by post_id order by activity_day) as prev_reach,
          lag(likes) over(partition by post_id order by activity_day) as prev_likes,
          lag(comments) over(partition by post_id order by activity_day) as prev_comments,
          lag(shares) over(partition by post_id order by activity_day) as prev_shares
        from post_daily
      ), deltas as (
        select
          post_id,
          activity_day,
          case when prev_reach is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(reach, 0) - coalesce(prev_reach, 0), 0) end as daily_reach,
          case when prev_likes is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(likes, 0) - coalesce(prev_likes, 0), 0) end as daily_likes,
          case when prev_comments is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(comments, 0) - coalesce(prev_comments, 0), 0) end as daily_comments,
          case when prev_shares is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(shares, 0) - coalesce(prev_shares, 0), 0) end as daily_shares
        from lagged
      )
      select
        d.activity_day,
        fp.post_id as id,
        fp.created_time,
        left(coalesce(fp.message, ''), 160) as title,
        fp.full_picture as image_url,
        null::text as media_type,
        null::text as permalink,
        coalesce(d.daily_likes, 0) as likes,
        coalesce(d.daily_comments, 0) as comments,
        coalesce(d.daily_shares, 0) as shares,
        0 as saves,
        0 as views,
        coalesce(d.daily_reach, 0) as impressions,
        coalesce(d.daily_likes, 0) as engagement_score
      from deltas d
      join outlaw_data.facebook_posts fp on fp.post_id = d.post_id
      where fp.account_id = '${accountIds.facebook}'
        and d.activity_day >= current_date - interval '180 days'
        and coalesce(d.daily_likes, 0) > 0
      order by d.activity_day desc, engagement_score desc, created_time desc
    `;

    const instagramPerformanceSql = `
      select date(date) as day, max(value) as reach
      from outlaw_data.instagram_insights
      where account_id = '${accountIds.instagram}'
        and metric = 'reach'
        and period = 'day'
      group by 1
      order by 1
    `;

    const instagramRecentSql = `
      with metric_rollup as (
        select
          imi.media_id,
          max(case when metric = 'likes' then value end) as likes,
          max(case when metric = 'comments' then value end) as comments,
          max(case when metric = 'saved' then value end) as saves,
          max(case when metric = 'shares' then value end) as shares
        from outlaw_data.instagram_media_insights imi
        join outlaw_data.instagram_media im on im.media_id = imi.media_id
        where im.account_id = '${accountIds.instagram}'
        group by imi.media_id
      ), recent as (
        select
          im.media_id,
          im.timestamp,
          im.media_type,
          coalesce(m.likes, 0) as likes,
          coalesce(m.comments, 0) as comments,
          coalesce(m.saves, 0) as saves,
          coalesce(m.shares, 0) as shares,
          coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.saves, 0) + coalesce(m.shares, 0) as engagement
        from outlaw_data.instagram_media im
        left join metric_rollup m on m.media_id = im.media_id
        where im.account_id = '${accountIds.instagram}'
          and im.timestamp >= now() - interval '30 days'
      )
      select
        count(*) as posts_30d,
        avg(engagement) as avg_engagement,
        avg(shares) as avg_shares,
        avg(saves) as avg_saves,
        max(engagement) as best_engagement
      from recent
    `;

    const instagramMixSql = `
      with metric_rollup as (
        select
          imi.media_id,
          max(case when metric = 'likes' then value end) as likes,
          max(case when metric = 'comments' then value end) as comments,
          max(case when metric = 'saved' then value end) as saves,
          max(case when metric = 'shares' then value end) as shares
        from outlaw_data.instagram_media_insights imi
        join outlaw_data.instagram_media im on im.media_id = imi.media_id
        where im.account_id = '${accountIds.instagram}'
        group by imi.media_id
      )
      select
        im.media_type,
        count(*) as posts,
        avg(coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.saves, 0) + coalesce(m.shares, 0)) as avg_engagement,
        avg(coalesce(m.shares, 0)) as avg_shares,
        avg(coalesce(m.saves, 0)) as avg_saves
      from outlaw_data.instagram_media im
      left join metric_rollup m on m.media_id = im.media_id
      where im.account_id = '${accountIds.instagram}'
      group by 1
      order by posts desc
    `;

    const instagramDemographicsSql = `
      with latest_days as (
        select breakdown_type, max(date(date)) as latest_day
        from outlaw_data.instagram_demographics
        where account_id = '${accountIds.instagram}'
        group by breakdown_type
      )
      select d.breakdown_type, d.key, d.value
      from outlaw_data.instagram_demographics d
      join latest_days ld
        on ld.breakdown_type = d.breakdown_type
       and ld.latest_day = date(d.date)
      where d.account_id = '${accountIds.instagram}'
      order by d.breakdown_type, d.value desc
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
        where im.account_id = '${accountIds.instagram}'
        group by imi.media_id
      )
      select
        im.media_id as id,
        im.timestamp as created_time,
        left(coalesce(im.caption, ''), 160) as title,
        coalesce(im.thumbnail_url, im.media_url) as image_url,
        im.media_type,
        im.permalink,
        coalesce(m.likes, 0) as likes,
        coalesce(m.comments, 0) as comments,
        coalesce(m.saves, 0) as saves,
        coalesce(m.shares, 0) as shares,
        coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.saves, 0) + coalesce(m.shares, 0) as engagement_score
      from outlaw_data.instagram_media im
      left join metric_rollup m on m.media_id = im.media_id
      where im.account_id = '${accountIds.instagram}'
      order by engagement_score desc, created_time desc
    `;

    const instagramActivityDriversSql = `
      with snapshots as (
        select
          imi.media_id,
          date(imi.date) as day,
          imi.metric,
          max(imi.value) as value
        from outlaw_data.instagram_media_insights imi
        join outlaw_data.instagram_media im on im.media_id = imi.media_id
        where im.account_id = '${accountIds.instagram}'
          and imi.metric in ('likes', 'comments', 'saved', 'shares')
        group by 1, 2, 3
      ), pivoted as (
        select
          snapshots.media_id,
          snapshots.day,
          min(date(im.timestamp)) as created_day,
          max(case when snapshots.metric = 'likes' then snapshots.value else 0 end) as likes,
          max(case when snapshots.metric = 'comments' then snapshots.value else 0 end) as comments,
          max(case when snapshots.metric = 'saved' then snapshots.value else 0 end) as saves,
          max(case when snapshots.metric = 'shares' then snapshots.value else 0 end) as shares
        from snapshots
        join outlaw_data.instagram_media im on im.media_id = snapshots.media_id
        group by 1, 2
      ), lagged as (
        select
          media_id,
          day,
          created_day,
          likes,
          comments,
          saves,
          shares,
          lag(likes) over(partition by media_id order by day) as prev_likes,
          lag(comments) over(partition by media_id order by day) as prev_comments,
          lag(saves) over(partition by media_id order by day) as prev_saves,
          lag(shares) over(partition by media_id order by day) as prev_shares
        from pivoted
      ), deltas as (
        select
          media_id,
          day,
          case when prev_likes is null and day > created_day + interval '1 day' then 0 else greatest(coalesce(likes, 0) - coalesce(prev_likes, 0), 0) end as daily_likes,
          case when prev_comments is null and day > created_day + interval '1 day' then 0 else greatest(coalesce(comments, 0) - coalesce(prev_comments, 0), 0) end as daily_comments,
          case when prev_saves is null and day > created_day + interval '1 day' then 0 else greatest(coalesce(saves, 0) - coalesce(prev_saves, 0), 0) end as daily_saves,
          case when prev_shares is null and day > created_day + interval '1 day' then 0 else greatest(coalesce(shares, 0) - coalesce(prev_shares, 0), 0) end as daily_shares
        from lagged
      )
      select
        d.day as activity_day,
        im.media_id as id,
        im.timestamp as created_time,
        left(coalesce(im.caption, ''), 160) as title,
        coalesce(im.thumbnail_url, im.media_url) as image_url,
        im.media_type,
        im.permalink,
        coalesce(d.daily_likes, 0) as likes,
        coalesce(d.daily_comments, 0) as comments,
        coalesce(d.daily_saves, 0) as saves,
        coalesce(d.daily_shares, 0) as shares,
        coalesce(d.daily_likes, 0) + coalesce(d.daily_comments, 0) + coalesce(d.daily_saves, 0) + coalesce(d.daily_shares, 0) as engagement_score
      from deltas d
      join outlaw_data.instagram_media im on im.media_id = d.media_id
      where d.day >= current_date - interval '180 days'
        and (coalesce(d.daily_likes, 0) + coalesce(d.daily_comments, 0) + coalesce(d.daily_saves, 0) + coalesce(d.daily_shares, 0)) > 0
      order by d.day desc, engagement_score desc, created_time desc
    `;

    const tiktokPerformanceSql = `
      with latest_per_video_day as (
        select
          s.video_id,
          date(s.snapshot_timestamp) as day,
          max(s.snapshot_timestamp) as latest_ts
        from outlaw_data.tiktok_video_snapshots s
        join outlaw_data.tiktok_videos v on v.video_id = s.video_id
        where v.account_open_id = '${accountIds.tiktok}'
        group by 1, 2
      ), daily_snapshots as (
        select
          lp.day,
          s.video_id,
          date(v.create_time) as created_day,
          s.view_count,
          s.like_count,
          s.comment_count,
          s.share_count
        from latest_per_video_day lp
        join outlaw_data.tiktok_video_snapshots s
          on s.video_id = lp.video_id
         and s.snapshot_timestamp = lp.latest_ts
        join outlaw_data.tiktok_videos v on v.video_id = s.video_id
      ), lagged as (
        select
          day,
          video_id,
          created_day,
          view_count,
          like_count,
          comment_count,
          share_count,
          lag(view_count) over(partition by video_id order by day) as prev_views,
          lag(like_count) over(partition by video_id order by day) as prev_likes,
          lag(comment_count) over(partition by video_id order by day) as prev_comments,
          lag(share_count) over(partition by video_id order by day) as prev_shares
        from daily_snapshots
      ), video_deltas as (
        select
          day,
          case when prev_views is null and day > created_day + interval '1 day' then 0 else greatest(coalesce(view_count, 0) - coalesce(prev_views, 0), 0) end as daily_views,
          case when prev_likes is null and day > created_day + interval '1 day' then 0 else greatest(coalesce(like_count, 0) - coalesce(prev_likes, 0), 0) end as daily_likes,
          case when prev_comments is null and day > created_day + interval '1 day' then 0 else greatest(coalesce(comment_count, 0) - coalesce(prev_comments, 0), 0) end as daily_comments,
          case when prev_shares is null and day > created_day + interval '1 day' then 0 else greatest(coalesce(share_count, 0) - coalesce(prev_shares, 0), 0) end as daily_shares
        from lagged
      ), daily_totals as (
        select
          day,
          sum(daily_views) as daily_views,
          sum(daily_likes) as daily_likes,
          sum(daily_comments) as daily_comments,
          sum(daily_shares) as daily_shares
        from video_deltas
        group by 1
      )
      select
        day,
        coalesce(daily_views, 0) as daily_views,
        coalesce(daily_likes, 0) as daily_likes,
        coalesce(daily_comments, 0) as daily_comments,
        coalesce(daily_shares, 0) as daily_shares
      from daily_totals
      order by day
    `;

    const tiktokRecentSql = `
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
      ), recent as (
        select
          tv.video_id,
          tv.create_time,
          tv.duration,
          coalesce(ls.view_count, 0) as views,
          coalesce(ls.like_count, 0) as likes,
          coalesce(ls.comment_count, 0) as comments,
          coalesce(ls.share_count, 0) as shares,
          coalesce(ls.like_count, 0) + coalesce(ls.comment_count, 0) + coalesce(ls.share_count, 0) as engagement
        from outlaw_data.tiktok_videos tv
        left join latest_snapshots ls on ls.video_id = tv.video_id
        where tv.account_open_id = '${accountIds.tiktok}'
          and tv.create_time >= now() - interval '30 days'
      )
      select
        count(*) as posts_30d,
        avg(views) as avg_views,
        avg(engagement) as avg_engagement,
        avg(duration) as avg_duration,
        sum(shares) as total_shares,
        max(views) as best_views
      from recent
    `;

    const tiktokAccountSql = `
      select follower_count, following_count, likes_count, video_count, is_verified
      from outlaw_data.tiktok_accounts
      where open_id = '${accountIds.tiktok}'
      order by last_synced_at desc
      limit 1
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
        null::text as media_type,
        tv.share_url as permalink,
        coalesce(ls.like_count, 0) as likes,
        coalesce(ls.comment_count, 0) as comments,
        coalesce(ls.share_count, 0) as shares,
        coalesce(ls.view_count, 0) as views,
        coalesce(ls.like_count, 0) + coalesce(ls.comment_count, 0) + coalesce(ls.share_count, 0) as engagement_score
      from outlaw_data.tiktok_videos tv
      left join latest_snapshots ls on ls.video_id = tv.video_id
      where tv.account_open_id = '${accountIds.tiktok}'
      order by engagement_score desc, views desc, create_time desc
    `;

    const tiktokViewDriversSql = `
      with latest_per_video_day as (
        select
          s.video_id,
          date(s.snapshot_timestamp) as activity_day,
          max(s.snapshot_timestamp) as latest_ts
        from outlaw_data.tiktok_video_snapshots s
        join outlaw_data.tiktok_videos v on v.video_id = s.video_id
        where v.account_open_id = '${accountIds.tiktok}'
        group by 1, 2
      ), daily_snapshots as (
        select
          lp.activity_day,
          s.video_id,
          date(v.create_time) as created_day,
          s.view_count,
          s.like_count,
          s.comment_count,
          s.share_count
        from latest_per_video_day lp
        join outlaw_data.tiktok_video_snapshots s
          on s.video_id = lp.video_id
         and s.snapshot_timestamp = lp.latest_ts
        join outlaw_data.tiktok_videos v on v.video_id = s.video_id
      ), lagged as (
        select
          activity_day,
          video_id,
          created_day,
          view_count,
          like_count,
          comment_count,
          share_count,
          lag(view_count) over(partition by video_id order by activity_day) as prev_views,
          lag(like_count) over(partition by video_id order by activity_day) as prev_likes,
          lag(comment_count) over(partition by video_id order by activity_day) as prev_comments,
          lag(share_count) over(partition by video_id order by activity_day) as prev_shares
        from daily_snapshots
      ), deltas as (
        select
          activity_day,
          video_id,
          case when prev_views is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(view_count, 0) - coalesce(prev_views, 0), 0) end as daily_views,
          case when prev_likes is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(like_count, 0) - coalesce(prev_likes, 0), 0) end as daily_likes,
          case when prev_comments is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(comment_count, 0) - coalesce(prev_comments, 0), 0) end as daily_comments,
          case when prev_shares is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(share_count, 0) - coalesce(prev_shares, 0), 0) end as daily_shares
        from lagged
      )
      select
        d.activity_day,
        tv.video_id as id,
        tv.create_time,
        left(coalesce(tv.title, tv.video_description, ''), 160) as title,
        tv.cover_image_url as image_url,
        null::text as media_type,
        tv.share_url as permalink,
        coalesce(d.daily_likes, 0) as likes,
        coalesce(d.daily_comments, 0) as comments,
        coalesce(d.daily_shares, 0) as shares,
        0 as saves,
        coalesce(d.daily_views, 0) as views,
        0 as impressions,
        coalesce(d.daily_views, 0) as engagement_score
      from deltas d
      join outlaw_data.tiktok_videos tv on tv.video_id = d.video_id
      where tv.account_open_id = '${accountIds.tiktok}'
        and d.activity_day >= current_date - interval '180 days'
        and coalesce(d.daily_views, 0) > 0
      order by d.activity_day desc, engagement_score desc, create_time desc
    `;

    const tiktokLikeDriversSql = `
      with latest_per_video_day as (
        select
          s.video_id,
          date(s.snapshot_timestamp) as activity_day,
          max(s.snapshot_timestamp) as latest_ts
        from outlaw_data.tiktok_video_snapshots s
        join outlaw_data.tiktok_videos v on v.video_id = s.video_id
        where v.account_open_id = '${accountIds.tiktok}'
        group by 1, 2
      ), daily_snapshots as (
        select
          lp.activity_day,
          s.video_id,
          date(v.create_time) as created_day,
          s.view_count,
          s.like_count,
          s.comment_count,
          s.share_count
        from latest_per_video_day lp
        join outlaw_data.tiktok_video_snapshots s
          on s.video_id = lp.video_id
         and s.snapshot_timestamp = lp.latest_ts
        join outlaw_data.tiktok_videos v on v.video_id = s.video_id
      ), lagged as (
        select
          activity_day,
          video_id,
          created_day,
          view_count,
          like_count,
          comment_count,
          share_count,
          lag(view_count) over(partition by video_id order by activity_day) as prev_views,
          lag(like_count) over(partition by video_id order by activity_day) as prev_likes,
          lag(comment_count) over(partition by video_id order by activity_day) as prev_comments,
          lag(share_count) over(partition by video_id order by activity_day) as prev_shares
        from daily_snapshots
      ), deltas as (
        select
          activity_day,
          video_id,
          case when prev_views is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(view_count, 0) - coalesce(prev_views, 0), 0) end as daily_views,
          case when prev_likes is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(like_count, 0) - coalesce(prev_likes, 0), 0) end as daily_likes,
          case when prev_comments is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(comment_count, 0) - coalesce(prev_comments, 0), 0) end as daily_comments,
          case when prev_shares is null and activity_day > created_day + interval '1 day' then 0 else greatest(coalesce(share_count, 0) - coalesce(prev_shares, 0), 0) end as daily_shares
        from lagged
      )
      select
        d.activity_day,
        tv.video_id as id,
        tv.create_time,
        left(coalesce(tv.title, tv.video_description, ''), 160) as title,
        tv.cover_image_url as image_url,
        null::text as media_type,
        tv.share_url as permalink,
        coalesce(d.daily_likes, 0) as likes,
        coalesce(d.daily_comments, 0) as comments,
        coalesce(d.daily_shares, 0) as shares,
        0 as saves,
        coalesce(d.daily_views, 0) as views,
        0 as impressions,
        coalesce(d.daily_likes, 0) as engagement_score
      from deltas d
      join outlaw_data.tiktok_videos tv on tv.video_id = d.video_id
      where tv.account_open_id = '${accountIds.tiktok}'
        and d.activity_day >= current_date - interval '180 days'
        and coalesce(d.daily_likes, 0) > 0
      order by d.activity_day desc, engagement_score desc, create_time desc
    `;

    const [
      followerTrendRows,
      facebookPerformanceRows,
      facebookRecentRows,
      facebookReactionRows,
      facebookTopPostRows,
      facebookReachDriverRows,
      facebookReactionDriverRows,
      instagramPerformanceRows,
      instagramRecentRows,
      instagramMixRows,
      instagramDemographicRows,
      instagramTopPostRows,
      instagramActivityDriverRows,
      tiktokPerformanceRows,
      tiktokRecentRows,
      tiktokAccountRows,
      tiktokTopPostRows,
      tiktokViewDriverRows,
      tiktokLikeDriverRows,
    ] = await Promise.all([
      runQuery<TrendRow>(followerTrendSql),
      runQuery<DailyMetricRow>(facebookPerformanceSql),
      runQuery<SummaryRow>(facebookRecentSql),
      runQuery<ReactionRow>(facebookReactionSql),
      runQuery<TopPostRow>(facebookTopPostsSql),
      runQuery<TopPostRow>(facebookReachDriversSql),
      runQuery<TopPostRow>(facebookReactionDriversSql),
      runQuery<DailyMetricRow>(instagramPerformanceSql),
      runQuery<SummaryRow>(instagramRecentSql),
      runQuery<InstagramMixRow>(instagramMixSql),
      runQuery<DemographicRow>(instagramDemographicsSql),
      runQuery<TopPostRow>(instagramTopPostsSql),
      runQuery<TopPostRow>(instagramActivityDriversSql),
      runQuery<DailyMetricRow>(tiktokPerformanceSql),
      runQuery<SummaryRow>(tiktokRecentSql),
      runQuery<TikTokAccountRow>(tiktokAccountSql),
      runQuery<TopPostRow>(tiktokTopPostsSql),
      runQuery<TopPostRow>(tiktokViewDriversSql),
      runQuery<TopPostRow>(tiktokLikeDriversSql),
    ]);

    const trendMap = new Map<
      string,
      { day: string; facebook: number | null; instagram: number | null; tiktok: number | null }
    >();

    for (const row of followerTrendRows) {
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

    const followersByPlatform = (Object.keys(platformMeta) as Platform[]).reduce(
      (acc, platform) => {
        acc[platform] = followerTrendRows
          .filter((row) => row.platform === platform)
          .sort((a, b) => a.day.localeCompare(b.day))
          .map((row) => ({ day: row.day, value: toNumber(row.followers) }));
        return acc;
      },
      {} as Record<Platform, DataPoint[]>
    );

    const facebookPerformance = buildDataPoints(facebookPerformanceRows, "reach");
    const facebookVideoViews = buildDataPoints(facebookPerformanceRows, "video_views");
    const facebookPageViews = buildDataPoints(facebookPerformanceRows, "page_views");
    const facebookReactions = buildDataPoints(facebookPerformanceRows, "reactions");

    const instagramPerformance = buildDataPoints(instagramPerformanceRows, "reach");

    const tiktokPerformance = buildDataPoints(tiktokPerformanceRows, "daily_views");
    const tiktokLikesTrend = buildDataPoints(tiktokPerformanceRows, "daily_likes");
    const tiktokSharesTrend = buildDataPoints(tiktokPerformanceRows, "daily_shares");

    const facebookLatestPerformance = getLatestPoint(facebookPerformance);
    const instagramLatestPerformance = getLatestPoint(instagramPerformance);
    const tiktokLatestPerformance = getLatestPoint(tiktokPerformance);

    const facebookRecent = facebookRecentRows[0] ?? {};
    const instagramRecent = instagramRecentRows[0] ?? {};
    const tiktokRecent = tiktokRecentRows[0] ?? {};
    const tiktokAccount = tiktokAccountRows[0] ?? {
      follower_count: 0,
      following_count: 0,
      likes_count: 0,
      video_count: 0,
      is_verified: false,
    };

    const demographicsByType = instagramDemographicRows.reduce(
      (acc, row) => {
        acc[row.breakdown_type] = acc[row.breakdown_type] ?? [];
        acc[row.breakdown_type].push(row);
        return acc;
      },
      {} as Record<string, DemographicRow[]>
    );

    const facebookReachDrivers = buildActivityDrivers(facebookReachDriverRows);
    const facebookReactionDrivers = buildActivityDrivers(facebookReactionDriverRows);
    const instagramActivityDrivers = buildActivityDrivers(instagramActivityDriverRows);
    const tiktokViewDrivers = buildActivityDrivers(tiktokViewDriverRows);
    const tiktokLikeDrivers = buildActivityDrivers(tiktokLikeDriverRows);

    const summaries = (Object.keys(platformMeta) as Platform[]).map((platform) => {
      const followersTrend = followersByPlatform[platform];
      const latestFollowers = getLatestPoint(followersTrend)?.value ?? 0;
      const firstFollowers = followersTrend[0]?.value ?? 0;

      const performanceTrend =
        platform === "facebook"
          ? facebookPerformance
          : platform === "instagram"
            ? instagramPerformance
            : tiktokPerformance;

      return {
        platform,
        label: platformMeta[platform].label,
        handle: platformMeta[platform].handle,
        metricLabel: platformMeta[platform].metricLabel,
        latestFollowers,
        deltaFollowers: latestFollowers - firstFollowers,
        points: followersTrend.length,
        performanceLabel: platformMeta[platform].performanceLabel,
        performanceNote: platformMeta[platform].performanceNote,
        followersTrend,
        performanceTrend,
        performanceLatest: getLatestPoint(performanceTrend)?.value ?? 0,
        performanceDelta: getPointDelta(performanceTrend),
      };
    });

    const platforms = {
      facebook: {
        platform: "facebook" as const,
        label: platformMeta.facebook.label,
        handle: platformMeta.facebook.handle,
        metricLabel: platformMeta.facebook.metricLabel,
        performanceLabel: platformMeta.facebook.performanceLabel,
        performanceNote: platformMeta.facebook.performanceNote,
        followersTrend: followersByPlatform.facebook,
        performanceTrend: facebookPerformance,
        secondaryLabel: "Daily reactions",
        secondaryTrend: facebookReactions,
        stats: [
          {
            label: "Followers",
            value: getLatestPoint(followersByPlatform.facebook)?.value ?? 0,
            note: `${followersByPlatform.facebook.length} tracked days`,
          },
          {
            label: "Latest reach",
            value: facebookLatestPerformance?.value ?? 0,
            note: "page impressions unique",
          },
          {
            label: "Latest video views",
            value: getLatestPoint(facebookVideoViews)?.value ?? 0,
            note: "page-level video views",
          },
          {
            label: "Latest page views",
            value: getLatestPoint(facebookPageViews)?.value ?? 0,
            note: "page_views_total",
          },
        ],
        groups: [
          {
            title: "Recent post performance",
            note: "Latest metrics across the last 30 days of Facebook posts.",
            items: [
              { label: "Posts in last 30 days", value: toNumber(facebookRecent.posts_30d) },
              { label: "Avg engagements per post", value: toNumber(facebookRecent.avg_engagement) },
              { label: "Avg impressions per post", value: toNumber(facebookRecent.avg_impressions) },
              { label: "Total shares", value: toNumber(facebookRecent.total_shares) },
            ],
          },
          {
            title: "Current reaction mix",
            note: "Latest daily page reaction totals.",
            items: facebookReactionRows.map((row) => ({
              label: row.reaction,
              value: toNumber(row.value),
            })),
          },
          {
            title: "Reach highlights",
            items: [
              {
                label: "Best reach day",
                value: getBestPoint(facebookPerformance)?.value ?? 0,
                note: getBestPoint(facebookPerformance)?.day,
              },
              {
                label: "Day-over-day reach",
                value: getPointDelta(facebookPerformance),
                note: "latest vs previous day",
              },
              {
                label: "Best reaction day",
                value: getBestPoint(facebookReactions)?.value ?? 0,
                note: getBestPoint(facebookReactions)?.day,
              },
            ],
          },
        ],
        activityDrivers: facebookReachDrivers,
        secondaryActivityDrivers: facebookReactionDrivers,
        topPosts: facebookTopPostRows.map(normalizePost),
      },
      instagram: {
        platform: "instagram" as const,
        label: platformMeta.instagram.label,
        handle: platformMeta.instagram.handle,
        metricLabel: platformMeta.instagram.metricLabel,
        performanceLabel: platformMeta.instagram.performanceLabel,
        performanceNote: platformMeta.instagram.performanceNote,
        followersTrend: followersByPlatform.instagram,
        performanceTrend: instagramPerformance,
        secondaryLabel: "Follower trend",
        secondaryTrend: followersByPlatform.instagram,
        stats: [
          {
            label: "Followers",
            value: getLatestPoint(followersByPlatform.instagram)?.value ?? 0,
            note: `${followersByPlatform.instagram.length} tracked days`,
          },
          {
            label: "Latest reach",
            value: instagramLatestPerformance?.value ?? 0,
            note: "account reach",
          },
          {
            label: "Tracked posts",
            value: instagramMixRows.reduce((sum, row) => sum + toNumber(row.posts), 0),
            note: "media available in dataset",
          },
          {
            label: "Best reach day",
            value: getBestPoint(instagramPerformance)?.value ?? 0,
            note: getBestPoint(instagramPerformance)?.day,
          },
        ],
        contentMix: instagramMixRows.map((row) => ({
          label: row.media_type,
          value: toNumber(row.posts),
          avgEngagement: toNumber(row.avg_engagement),
          avgShares: toNumber(row.avg_shares),
          avgSaves: toNumber(row.avg_saves),
        })),
        topCities: (demographicsByType.city ?? []).slice(0, 12).map((row) => ({
          label: row.key,
          value: toNumber(row.value),
        })),
        audience: {
          age: (demographicsByType.age ?? []).map((row) => ({
            label: row.key,
            value: toNumber(row.value),
          })),
          country: (demographicsByType.country ?? []).map((row) => ({
            label: row.key,
            value: toNumber(row.value),
          })),
          gender: (demographicsByType.gender ?? []).map((row) => ({
            label: row.key,
            value: toNumber(row.value),
          })),
        },
        groups: [
          {
            title: "Recent post performance",
            note: "Last 30 days of tracked Instagram posts.",
            items: [
              { label: "Posts in last 30 days", value: toNumber(instagramRecent.posts_30d) },
              { label: "Avg engagements per post", value: toNumber(instagramRecent.avg_engagement) },
              { label: "Avg shares per post", value: toNumber(instagramRecent.avg_shares) },
              { label: "Avg saves per post", value: toNumber(instagramRecent.avg_saves) },
            ],
          },
          {
            title: "Content mix",
            note: "Average lifetime engagement by media type.",
            items: instagramMixRows.map((row) => ({
              label: row.media_type,
              value: toNumber(row.posts),
              note: `${Math.round(toNumber(row.avg_engagement))} avg engagements`,
            })),
          },
          {
            title: "Top cities",
            note: "Latest audience demographic snapshot.",
            items: (demographicsByType.city ?? []).slice(0, 5).map((row) => ({
              label: row.key,
              value: toNumber(row.value),
            })),
          },
          {
            title: "Audience profile",
            items: [
              ...(demographicsByType.age ?? []).slice(0, 4).map((row) => ({
                label: `Age ${row.key}`,
                value: toNumber(row.value),
              })),
              ...(demographicsByType.country ?? []).slice(0, 2).map((row) => ({
                label: `Country ${row.key}`,
                value: toNumber(row.value),
              })),
              ...(demographicsByType.gender ?? []).slice(0, 2).map((row) => ({
                label: `Gender ${row.key}`,
                value: toNumber(row.value),
              })),
            ],
          },
        ],
        activityDrivers: instagramActivityDrivers,
        topPosts: instagramTopPostRows.map(normalizePost),
      },
      tiktok: {
        platform: "tiktok" as const,
        label: platformMeta.tiktok.label,
        handle: platformMeta.tiktok.handle,
        metricLabel: platformMeta.tiktok.metricLabel,
        performanceLabel: platformMeta.tiktok.performanceLabel,
        performanceNote: platformMeta.tiktok.performanceNote,
        followersTrend: followersByPlatform.tiktok,
        performanceTrend: tiktokPerformance,
        secondaryLabel: "Daily likes",
        secondaryTrend: tiktokLikesTrend,
        stats: [
          {
            label: "Followers",
            value: toNumber(tiktokAccount.follower_count),
            note: followersByPlatform.tiktok.length > 1 ? `${followersByPlatform.tiktok.length} tracked days` : "Latest synced follower snapshot",
          },
          {
            label: "Latest daily views",
            value: tiktokLatestPerformance?.value ?? 0,
            note: "from snapshot deltas",
          },
          {
            label: "Account likes",
            value: toNumber(tiktokAccount.likes_count),
            note: "lifetime likes",
          },
          {
            label: "Videos tracked",
            value: toNumber(tiktokAccount.video_count),
            note: tiktokAccount.is_verified ? "verified account" : "unverified account",
          },
        ],
        groups: [
          {
            title: "Recent video performance",
            note: "Last 30 days of TikTok posts.",
            items: [
              { label: "Posts in last 30 days", value: toNumber(tiktokRecent.posts_30d) },
              { label: "Avg views per post", value: toNumber(tiktokRecent.avg_views) },
              { label: "Avg engagements per post", value: toNumber(tiktokRecent.avg_engagement) },
              { label: "Total shares", value: toNumber(tiktokRecent.total_shares) },
            ],
          },
          {
            title: "Current pace",
            note: "Daily deltas from the latest video snapshot history.",
            items: [
              { label: "Views today", value: tiktokLatestPerformance?.value ?? 0 },
              { label: "Likes today", value: getLatestPoint(tiktokLikesTrend)?.value ?? 0 },
              { label: "Shares today", value: getLatestPoint(tiktokSharesTrend)?.value ?? 0 },
              {
                label: "Avg duration (sec)",
                value: Math.round(toNumber(tiktokRecent.avg_duration)),
              },
            ],
          },
          {
            title: "View highlights",
            items: [
              {
                label: "Best daily views",
                value: getBestPoint(tiktokPerformance)?.value ?? 0,
                note: getBestPoint(tiktokPerformance)?.day,
              },
              {
                label: "Best video views (30d)",
                value: toNumber(tiktokRecent.best_views),
              },
              {
                label: "Following",
                value: toNumber(tiktokAccount.following_count),
              },
            ],
          },
        ],
        activityDrivers: tiktokViewDrivers,
        secondaryActivityDrivers: tiktokLikeDrivers,
        topPosts: tiktokTopPostRows.map(normalizePost),
      },
    };

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        selectedAccount: account.key,
        accounts: SOCIAL_ACCOUNTS.map(({ key, label }) => ({ key, label })),
        trend,
        summaries,
        platforms,
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
