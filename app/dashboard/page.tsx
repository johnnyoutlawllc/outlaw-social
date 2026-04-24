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

type DashboardPayload = {
  generatedAt: string;
  trend: TrendPoint[];
  summaries: Summary[];
  topPosts: Record<Platform, TopPost[]>;
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
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}

function formatDelta(value: number) {
  if (value === 0) return "flat";
  return `${value > 0 ? "+" : ""}${formatCompactNumber(value)}`;
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const followerSummary = useMemo(() => {
    if (!data) return null;

    return data.summaries.reduce(
      (acc, summary) => {
        acc.totalFollowers += summary.latestFollowers;
        acc.totalTrackedPoints += summary.points;
        return acc;
      },
      { totalFollowers: 0, totalTrackedPoints: 0 }
    );
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
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px 96px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 28,
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
            Daily followers and top posts
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 16, lineHeight: 1.6, maxWidth: 780 }}>
            Live pull from the `outlaw_data` social tables for Facebook, Instagram, and TikTok.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
          <div className="pill">Updated {formatDateTime(data.generatedAt)}</div>
          <div className="pill">
            {followerSummary ? `${formatCompactNumber(followerSummary.totalFollowers)} total followers` : "Live data"}
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {data.summaries.map((summary) => (
          <div key={summary.platform} className="card" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "999px",
                  background: PLATFORM_COLORS[summary.platform],
                  boxShadow: `0 0 0 6px ${PLATFORM_COLORS[summary.platform]}22`,
                }}
              />
              <div>
                <div style={{ fontWeight: 700 }}>{summary.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{summary.handle}</div>
              </div>
            </div>

            <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 6 }}>
              {formatCompactNumber(summary.latestFollowers)}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
              followers
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Trend</div>
                <div style={{ color: summary.deltaFollowers >= 0 ? "#86efac" : "#fca5a5", fontWeight: 700 }}>
                  {formatDelta(summary.deltaFollowers)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Points</div>
                <div style={{ fontWeight: 700 }}>{summary.points}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Daily followers by platform</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              TikTok is showing the latest synced point right now because daily history has not populated yet.
            </p>
          </div>
          <div className="pill">
            {data.trend.length} tracked days
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data.trend} margin={{ left: 8, right: 18, top: 12, bottom: 0 }}>
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
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {(Object.keys(data.topPosts) as Platform[]).map((platform) => (
          <div key={platform} className="card" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "999px",
                  background: PLATFORM_COLORS[platform],
                }}
              />
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                  Top {PLATFORM_LABELS[platform]} posts
                </h2>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  Ranked by {data.summaries.find((summary) => summary.platform === platform)?.metricLabel}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {data.topPosts[platform].map((post) => (
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
                      PLATFORM_LABELS[platform]
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
                        {renderSecondaryMetric(platform, post)}
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
        ))}
      </div>
    </div>
  );
}
