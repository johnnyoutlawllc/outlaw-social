"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Platform = "facebook" | "instagram" | "tiktok";
type TabKey = "all" | Platform;

type DataPoint = {
  day: string;
  value: number;
};

type TrendPoint = {
  day: string;
  facebook: number | null;
  instagram: number | null;
  tiktok: number | null;
};

type Summary = {
  platform: Platform;
  label: string;
  handle: string;
  metricLabel: string;
  latestFollowers: number;
  deltaFollowers: number;
  points: number;
  performanceLabel: string;
  performanceNote: string;
  performanceTrend: DataPoint[];
  performanceLatest: number;
  performanceDelta: number;
};

type InsightItem = {
  label: string;
  value: number | string;
  note?: string;
};

type InsightGroup = {
  title: string;
  note?: string;
  items: InsightItem[];
};

type TopPost = {
  id: string;
  createdAt: string | null;
  title: string;
  imageUrl: string | null;
  permalink: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  impressions: number;
  engagementScore: number;
};

type PlatformDetails = {
  platform: Platform;
  label: string;
  handle: string;
  metricLabel: string;
  performanceLabel: string;
  performanceNote: string;
  followersTrend: DataPoint[];
  performanceTrend: DataPoint[];
  secondaryLabel: string;
  secondaryTrend: DataPoint[];
  stats: InsightItem[];
  groups: InsightGroup[];
  topPosts: TopPost[];
};

type DashboardPayload = {
  generatedAt: string;
  trend: TrendPoint[];
  summaries: Summary[];
  platforms: Record<Platform, PlatformDetails>;
};

const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  tiktok: "#ff6b35",
};

const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

function formatCompactNumber(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `${value < 0 ? "-" : ""}${(absolute / 1_000_000).toFixed(1)}M`;
  }

  if (absolute >= 1_000) {
    return `${value < 0 ? "-" : ""}${(absolute / 1_000).toFixed(1)}k`;
  }

  if (!Number.isInteger(value)) {
    return value.toFixed(1);
  }

  return value.toString();
}

function formatDelta(value: number) {
  if (value === 0) return "flat";
  return `${value > 0 ? "+" : ""}${formatCompactNumber(value)}`;
}

function formatValue(value: number | string) {
  return typeof value === "number" ? formatCompactNumber(value) : value;
}

function formatShortDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "Unknown date";

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderSecondaryMetric(platform: Platform, post: TopPost) {
  if (platform === "instagram") {
    return `${formatCompactNumber(post.saves)} saves`;
  }

  if (platform === "facebook") {
    return `${formatCompactNumber(post.impressions)} impressions`;
  }

  return `${formatCompactNumber(post.views)} views`;
}

function MiniSparkline({ data, color }: { data: DataPoint[]; color: string }) {
  if (data.length === 0) {
    return <div style={{ height: 56, color: "var(--text-muted)", fontSize: 12 }}>No trend yet</div>;
  }

  return (
    <div style={{ width: "100%", height: 56 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SummaryTile({ summary }: { summary: Summary }) {
  const color = PLATFORM_COLORS[summary.platform];

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "999px",
            background: color,
            boxShadow: `0 0 0 6px ${color}22`,
          }}
        />
        <div>
          <div style={{ fontWeight: 700 }}>{summary.label}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{summary.handle}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "end", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>
            {formatCompactNumber(summary.latestFollowers)}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>followers</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: summary.deltaFollowers >= 0 ? "#86efac" : "#fca5a5", fontWeight: 700 }}>
            {formatDelta(summary.deltaFollowers)}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>tracked period</div>
        </div>
      </div>

      <MiniSparkline data={summary.performanceTrend} color={color} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end", marginTop: 12 }}>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>{summary.performanceLabel}</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{formatCompactNumber(summary.performanceLatest)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: summary.performanceDelta >= 0 ? "#86efac" : "#fca5a5", fontWeight: 700 }}>
            {formatDelta(summary.performanceDelta)}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{summary.performanceNote}</div>
        </div>
      </div>
    </div>
  );
}

function MultiPlatformFollowersChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ left: 8, right: 18, top: 12, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickFormatter={formatShortDate}
          stroke="var(--text-muted)"
          tick={{ fontSize: 12 }}
          minTickGap={24}
        />
        <YAxis
          stroke="var(--text-muted)"
          tick={{ fontSize: 12 }}
          tickFormatter={(value: number) => formatCompactNumber(value)}
          width={64}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
          }}
          labelFormatter={(label) => formatShortDate(String(label))}
          formatter={(value, name) => {
            const key = String(name) as Platform;
            return [formatCompactNumber(Number(value ?? 0)), PLATFORM_LABELS[key] ?? String(name)];
          }}
        />
        <Legend />
        {(Object.keys(PLATFORM_COLORS) as Platform[]).map((platform) => (
          <Line
            key={platform}
            type="monotone"
            dataKey={platform}
            stroke={PLATFORM_COLORS[platform]}
            strokeWidth={3}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
            connectNulls
            name={PLATFORM_LABELS[platform]}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function SingleSeriesChart({
  title,
  note,
  series,
  color,
}: {
  title: string;
  note?: string;
  series: DataPoint[];
  color: string;
}) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
        {note ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{note}</p> : null}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={series} margin={{ left: 0, right: 16, top: 12, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickFormatter={formatShortDate}
            stroke="var(--text-muted)"
            tick={{ fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => formatCompactNumber(value)}
            width={64}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
            }}
            labelFormatter={(label) => formatShortDate(String(label))}
            formatter={(value) => formatCompactNumber(Number(value ?? 0))}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatsGrid({ stats }: { stats: InsightItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 16,
      }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            padding: 18,
            borderRadius: 16,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 6 }}>{stat.label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: stat.note ? 6 : 0 }}>
            {formatValue(stat.value)}
          </div>
          {stat.note ? <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{stat.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

function InsightGroups({ groups }: { groups: InsightGroup[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
        marginBottom: 20,
      }}
    >
      {groups.map((group) => (
        <div key={group.title} className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{group.title}</h3>
            {group.note ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{group.note}</p> : null}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {group.items.map((item) => (
              <div
                key={`${group.title}-${item.label}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                  paddingBottom: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{item.label}</div>
                  {item.note ? <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{item.note}</div> : null}
                </div>
                <div style={{ fontWeight: 700, color: "var(--accent)" }}>{formatValue(item.value)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TopPostsSection({ detail }: { detail: PlatformDetails }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          Top {detail.label} posts
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Ranked by {detail.metricLabel}
        </p>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {detail.topPosts.map((post) => (
          <article
            key={post.id}
            style={{
              display: "grid",
              gridTemplateColumns: "96px 1fr",
              gap: 14,
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 14,
                overflow: "hidden",
                background: "rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: 12,
                textTransform: "uppercase",
              }}
            >
              {post.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                detail.label
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>
                {formatDateTime(post.createdAt)}
              </div>
              <div
                style={{
                  fontWeight: 700,
                  lineHeight: 1.45,
                  marginBottom: 10,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {post.title}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div className="pill">{formatCompactNumber(post.engagementScore)} engagements</div>
                <div className="pill">{formatCompactNumber(post.likes)} likes</div>
                <div className="pill">{formatCompactNumber(post.comments)} comments</div>
                <div className="pill">{formatCompactNumber(post.shares)} shares</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {renderSecondaryMetric(detail.platform, post)}
                </div>
                {post.permalink ? (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--accent)",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Open post
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PlatformSection({ detail }: { detail: PlatformDetails }) {
  const color = PLATFORM_COLORS[detail.platform];

  return (
    <section className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "999px",
            background: color,
          }}
        />
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{detail.label}</h2>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{detail.handle}</div>
        </div>
      </div>

      <StatsGrid stats={detail.stats} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <SingleSeriesChart
          title="Follower trend"
          note="Daily tracked followers."
          series={detail.followersTrend}
          color={color}
        />
        <SingleSeriesChart
          title={detail.performanceLabel}
          note={detail.performanceNote}
          series={detail.performanceTrend}
          color={color}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <SingleSeriesChart
          title={detail.secondaryLabel}
          series={detail.secondaryTrend}
          color={color}
        />
      </div>

      <InsightGroups groups={detail.groups} />
      <TopPostsSection detail={detail} />
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const payload = await response.json();

        if (response.status === 401 || response.status === 403) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load dashboard data.");
        }

        if (!cancelled) {
          setData(payload as DashboardPayload);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDetail = useMemo(() => {
    if (!data || activeTab === "all") return null;
    return data.platforms[activeTab];
  }, [activeTab, data]);

  const followerSummary = useMemo(() => {
    if (!data) return 0;
    return data.summaries.reduce((sum, summary) => sum + summary.latestFollowers, 0);
  }, [data]);

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading Big Sky 30 metrics...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 640, margin: "72px auto", padding: "0 24px" }}>
        <div className="card" style={{ padding: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Big Sky 30 dashboard</h1>
          <p style={{ color: "#fca5a5", marginBottom: 20 }}>
            {error ?? "Dashboard data is not available right now."}
          </p>
          <button className="btn-primary" type="button" onClick={() => window.location.reload()}>
            Reload dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px 24px 96px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Big Sky 30 social analytics
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.05, marginBottom: 10 }}>
            Followers, reach, and platform breakdowns
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 16, lineHeight: 1.6, maxWidth: 820 }}>
            Tabs split the view into All Platforms, Facebook, Instagram, and TikTok. Summary tiles now include daily performance sparklines pulled from the tracked history tables.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
          <div className="pill">Updated {formatDateTime(data.generatedAt)}</div>
          <div className="pill">{formatCompactNumber(followerSummary)} total followers</div>
          <form action="/api/auth/signout" method="post">
            <button className="btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {(["all", "facebook", "instagram", "tiktok"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: activeTab === tab ? "var(--accent)" : "transparent",
              color: activeTab === tab ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {tab === "all" ? "All Platforms" : PLATFORM_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "all" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {data.summaries.map((summary) => (
              <SummaryTile key={summary.platform} summary={summary} />
            ))}
          </div>

          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Daily followers by platform</h2>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  Cross-platform follower history. TikTok is still on sparse account-history snapshots.
                </p>
              </div>
              <div className="pill">{data.trend.length} tracked days</div>
            </div>
            <MultiPlatformFollowersChart data={data.trend} />
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            {(Object.keys(data.platforms) as Platform[]).map((platform) => (
              <PlatformSection key={platform} detail={data.platforms[platform]} />
            ))}
          </div>
        </>
      ) : selectedDetail ? (
        <div style={{ display: "grid", gap: 20 }}>
          <SummaryTile summary={data.summaries.find((summary) => summary.platform === activeTab)!} />
          <PlatformSection detail={selectedDetail} />
        </div>
      ) : null}
    </div>
  );
}
