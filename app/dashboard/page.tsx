"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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

type BreakdownDatum = {
  label: string;
  value: number;
};

type ContentMixDatum = BreakdownDatum & {
  avgEngagement: number;
  avgShares: number;
  avgSaves: number;
};

type AudienceBreakdown = {
  age: BreakdownDatum[];
  country: BreakdownDatum[];
  gender: BreakdownDatum[];
};

type TopPost = {
  id: string;
  createdAt: string | null;
  title: string;
  imageUrl: string | null;
  mediaType?: string | null;
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
  contentMix?: ContentMixDatum[];
  topCities?: BreakdownDatum[];
  audience?: AudienceBreakdown;
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

const MIX_COLORS = ["#ff6b35", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6", "#14b8a6"];

const TEXAS_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  arlington: { lat: 32.7357, lng: -97.1081 },
  austin: { lat: 30.2672, lng: -97.7431 },
  dallas: { lat: 32.7767, lng: -96.797 },
  fate: { lat: 32.9407, lng: -96.3819 },
  forney: { lat: 32.7482, lng: -96.4719 },
  frisco: { lat: 33.1507, lng: -96.8236 },
  garland: { lat: 32.9126, lng: -96.6389 },
  heath: { lat: 32.8365, lng: -96.4744 },
  houston: { lat: 29.7604, lng: -95.3698 },
  irving: { lat: 32.814, lng: -96.9489 },
  mckinney: { lat: 33.1976, lng: -96.6153 },
  mesquite: { lat: 32.7668, lng: -96.5992 },
  "mclendon-chisholm": { lat: 32.844, lng: -96.3922 },
  plano: { lat: 33.0198, lng: -96.6989 },
  richardson: { lat: 32.9483, lng: -96.7299 },
  rockwall: { lat: 32.9312, lng: -96.4597 },
  royse: { lat: 32.9752, lng: -96.3325 },
  "royse city": { lat: 32.9752, lng: -96.3325 },
  rowlett: { lat: 32.9029, lng: -96.5639 },
  "san antonio": { lat: 29.4241, lng: -98.4936 },
  terrell: { lat: 32.7357, lng: -96.2753 },
  wylie: { lat: 33.0151, lng: -96.5389 },
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

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
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

function normalizeMediaType(value: string | null | undefined) {
  if (!value) return "Post";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
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

function getNumericDomain(values: number[], includeZero: boolean): [number, number] {
  const safeValues = values.filter((value) => Number.isFinite(value));

  if (safeValues.length === 0) {
    return [0, 10];
  }

  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);

  if (includeZero) {
    return [0, Math.max(max * 1.08, 10)];
  }

  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.08, 5);
    return [Math.max(0, min - padding), max + padding];
  }

  const span = max - min;
  const padding = Math.max(span * 0.12, 2);

  return [Math.max(0, min - padding), max + padding];
}

function getCityCoordinates(label: string) {
  const city = label.split(",")[0]?.trim().toLowerCase() ?? "";
  return TEXAS_CITY_COORDS[city] ?? null;
}

function buildPercentageRows(items: BreakdownDatum[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return items
    .filter((item) => item.value > 0)
    .map((item) => ({
      ...item,
      percent: total > 0 ? (item.value / total) * 100 : 0,
    }))
    .sort((a, b) => b.percent - a.percent);
}

function AxisToggle({
  includeZero,
  onChange,
}: {
  includeZero: boolean;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          padding: "7px 11px",
          borderRadius: 999,
          border: "none",
          background: includeZero ? "var(--accent)" : "transparent",
          color: includeZero ? "#fff" : "var(--text-muted)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Include 0
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          padding: "7px 11px",
          borderRadius: 999,
          border: "none",
          background: !includeZero ? "rgba(255,255,255,0.08)" : "transparent",
          color: !includeZero ? "#fff" : "var(--text-muted)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Zoom
      </button>
    </div>
  );
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

function SummaryTile({
  summary,
  onSelect,
}: {
  summary: Summary;
  onSelect?: (platform: Platform) => void;
}) {
  const color = PLATFORM_COLORS[summary.platform];
  const sharedStyle = {
    padding: 22,
    cursor: onSelect ? "pointer" : "default",
    textAlign: "left" as const,
    width: "100%",
  };

  const content = (
    <>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          alignItems: "end",
          marginBottom: 12,
        }}
      >
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          alignItems: "end",
          marginTop: 12,
        }}
      >
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
            {summary.performanceLabel}
          </div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{formatCompactNumber(summary.performanceLatest)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: summary.performanceDelta >= 0 ? "#86efac" : "#fca5a5", fontWeight: 700 }}>
            {formatDelta(summary.performanceDelta)}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{summary.performanceNote}</div>
        </div>
      </div>
    </>
  );

  if (!onSelect) {
    return (
      <div className="card" style={sharedStyle}>
        {content}
      </div>
    );
  }

  return (
    <button
      className="card"
      type="button"
      onClick={() => onSelect(summary.platform)}
      style={{
        ...sharedStyle,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "var(--bg-card)",
      }}
    >
      {content}
    </button>
  );
}

function FollowersOverviewCard({ data }: { data: TrendPoint[] }) {
  const [includeZero, setIncludeZero] = useState(true);
  const yDomain = useMemo(
    () =>
      getNumericDomain(
        data.flatMap((point) => [point.facebook, point.instagram, point.tiktok].filter((value): value is number => value !== null)),
        includeZero
      ),
    [data, includeZero]
  );

  return (
    <div className="card" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Daily followers by platform</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Cross-platform follower history. TikTok is still on sparse account-history snapshots.
          </p>
        </div>
        <AxisToggle includeZero={includeZero} onChange={setIncludeZero} />
      </div>

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
            domain={yDomain}
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
  );
}

function TrendCard({
  title,
  note,
  series,
  color,
  allowZeroToggle = false,
}: {
  title: string;
  note?: string;
  series: DataPoint[];
  color: string;
  allowZeroToggle?: boolean;
}) {
  const [includeZero, setIncludeZero] = useState(true);
  const yDomain = useMemo(
    () => getNumericDomain(series.map((point) => point.value), allowZeroToggle ? includeZero : true),
    [allowZeroToggle, includeZero, series]
  );

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
          {note ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{note}</p> : null}
        </div>
        {allowZeroToggle ? <AxisToggle includeZero={includeZero} onChange={setIncludeZero} /> : null}
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
            domain={yDomain}
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

function PostThumbnail({ post, platform }: { post: TopPost; platform: Platform }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(post.imageUrl) && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.imageUrl ?? undefined}
        alt={post.title}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background:
          platform === "instagram"
            ? "linear-gradient(160deg, rgba(225,48,108,0.30), rgba(255,107,53,0.18))"
            : platform === "facebook"
              ? "linear-gradient(160deg, rgba(24,119,242,0.28), rgba(24,119,242,0.10))"
              : "linear-gradient(160deg, rgba(255,107,53,0.26), rgba(255,107,53,0.10))",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: 12,
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
        {PLATFORM_LABELS[platform]}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{normalizeMediaType(post.mediaType)}</span>
    </div>
  );
}

function TopPostsSection({ detail }: { detail: PlatformDetails }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Top {detail.label} posts</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Ranked by {detail.metricLabel}</p>
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
                color: "var(--text-muted)",
              }}
            >
              <PostThumbnail post={post} platform={detail.platform} />
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

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
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

function InstagramContentMixCard({ data }: { data: ContentMixDatum[] }) {
  if (data.length === 0) {
    return null;
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Content mix</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Post volume by media type, with engagement context.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: 18, alignItems: "center" }}>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={64}
                outerRadius={92}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={MIX_COLORS[index % MIX_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
                formatter={(value, name) => [formatCompactNumber(Number(value ?? 0)), String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {data.map((item, index) => (
            <div
              key={item.label}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 10,
                alignItems: "start",
                paddingBottom: 10,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "999px",
                  marginTop: 5,
                  background: MIX_COLORS[index % MIX_COLORS.length],
                }}
              />
              <div>
                <div style={{ fontWeight: 700 }}>{normalizeMediaType(item.label)}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {formatCompactNumber(item.avgEngagement)} avg engagements · {formatCompactNumber(item.avgSaves)} saves
                </div>
              </div>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{formatCompactNumber(item.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TexasAudienceMap({ cities }: { cities: BreakdownDatum[] }) {
  const mappedCities = cities
    .map((city) => {
      const coords = getCityCoordinates(city.label);
      if (!coords) return null;

      const x = ((coords.lng + 106.7) / 13.2) * 320;
      const y = (1 - (coords.lat - 25.8) / 10.7) * 240;

      return {
        ...city,
        x,
        y,
      };
    })
    .filter((city): city is BreakdownDatum & { x: number; y: number } => city !== null);

  const maxValue = Math.max(...cities.map((city) => city.value), 1);

  return (
    <svg viewBox="0 0 320 240" style={{ width: "100%", height: "100%" }} aria-label="Texas city audience map">
      <path
        d="M57 26 L116 29 L126 42 L158 46 L214 46 L219 94 L253 109 L241 143 L255 169 L233 201 L198 190 L156 199 L108 183 L92 169 L61 166 L49 130 L54 108 L39 81 Z"
        fill="rgba(255,255,255,0.03)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="2"
      />
      {mappedCities.map((city) => {
        const radius = 5 + (city.value / maxValue) * 12;

        return (
          <g key={city.label}>
            <circle cx={city.x} cy={city.y} r={radius + 4} fill="rgba(255,107,53,0.12)" />
            <circle cx={city.x} cy={city.y} r={radius} fill="rgba(255,107,53,0.85)" stroke="#fff" strokeWidth="1.5" />
          </g>
        );
      })}
    </svg>
  );
}

function InstagramCitiesCard({ cities }: { cities: BreakdownDatum[] }) {
  if (cities.length === 0) {
    return null;
  }

  const chartData = cities.slice(0, 6).map((city) => ({
    ...city,
    shortLabel: city.label.replace(", Texas", ""),
  }));

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Top cities</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Latest demographic snapshot, mapped into Texas where we have city coordinates.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(260px, 1.2fr)", gap: 18, alignItems: "center" }}>
        <div style={{ width: "100%", height: 240 }}>
          <TexasAudienceMap cities={cities} />
        </div>

        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 12, left: 6, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                stroke="var(--text-muted)"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: number) => formatCompactNumber(value)}
              />
              <YAxis
                type="category"
                dataKey="shortLabel"
                stroke="var(--text-muted)"
                tick={{ fontSize: 12 }}
                width={96}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
                formatter={(value) => formatCompactNumber(Number(value ?? 0))}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function PercentageBarList({
  title,
  items,
  color,
}: {
  title: string;
  items: BreakdownDatum[];
  color: string;
}) {
  const rows = buildPercentageRows(items);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {title}
      </div>
      {rows.map((row) => (
        <div key={`${title}-${row.label}`} style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
            <span>{row.label}</span>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{formatPercent(row.percent)}</span>
          </div>
          <div
            style={{
              width: "100%",
              height: 10,
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(row.percent, 2)}%`,
                height: "100%",
                borderRadius: 999,
                background: color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function InstagramAudienceCard({ audience }: { audience: AudienceBreakdown }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Audience profile</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Percent split within each audience bucket instead of raw counts.</p>
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <PercentageBarList title="Age" items={audience.age} color="#ff6b35" />
        <PercentageBarList title="Country" items={audience.country} color="#f59e0b" />
        <PercentageBarList title="Gender" items={audience.gender} color="#ec4899" />
      </div>
    </div>
  );
}

function InstagramInsights({ detail }: { detail: PlatformDetails }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        marginBottom: 20,
      }}
    >
      <InstagramContentMixCard data={detail.contentMix ?? []} />
      <InstagramCitiesCard cities={detail.topCities ?? []} />
      {detail.audience ? <InstagramAudienceCard audience={detail.audience} /> : null}
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
        <TrendCard
          title="Follower trend"
          note="Daily tracked followers."
          series={detail.followersTrend}
          color={color}
          allowZeroToggle
        />
        <TrendCard
          title={detail.performanceLabel}
          note={detail.performanceNote}
          series={detail.performanceTrend}
          color={color}
        />
      </div>

      {detail.platform !== "instagram" ? (
        <div style={{ marginBottom: 16 }}>
          <TrendCard title={detail.secondaryLabel} series={detail.secondaryTrend} color={color} />
        </div>
      ) : null}

      {detail.platform === "instagram" ? (
        <InstagramInsights detail={detail} />
      ) : (
        <InsightGroups groups={detail.groups} />
      )}

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
            Platform tabs now hold the deep dives. Instagram has dedicated audience visuals instead of the generic insight cards.
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
              <SummaryTile key={summary.platform} summary={summary} onSelect={setActiveTab} />
            ))}
          </div>

          <FollowersOverviewCard data={data.trend} />
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
