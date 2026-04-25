"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
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
type MetricKey = "followers" | "reach" | "likes" | "comments" | "shares";
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
  followersTrend: DataPoint[];
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
  activityDrivers?: Record<string, TopPost[]>;
  secondaryActivityDrivers?: Record<string, TopPost[]>;
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

const SOUTH_MAP_BOUNDS = {
  minLng: -103,
  maxLng: -84,
  minLat: 24,
  maxLat: 38,
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

function buildMetricTrend(drivers: { [k: string]: TopPost[] }, field: "likes" | "comments" | "shares"): DataPoint[] {
  return Object.entries(drivers)
    .map(([day, posts]) => ({ day, value: posts.reduce((s, p) => s + (p[field] as number), 0) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

function getCutoff(days: number): string {
  if (days >= 365) return "0000-00-00";
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function filterDays(data: DataPoint[], days: number, endDate = ""): DataPoint[] {
  const cut = days >= 365 ? "0000-00-00" : getCutoff(days);
  return data.filter((p) => p.day >= cut && (!endDate || p.day <= endDate));
}
function filterTrendDays(data: TrendPoint[], days: number, endDate = ""): TrendPoint[] {
  const cut = days >= 365 ? "0000-00-00" : getCutoff(days);
  return data.filter((p) => p.day >= cut && (!endDate || p.day <= endDate));
}
function filterPostDays(posts: TopPost[], days: number, endDate = ""): TopPost[] {
  const cut = days >= 365 ? "0000-00-00" : getCutoff(days);
  return posts.filter((p) => (p.createdAt ?? "9999") >= cut && (!endDate || (p.createdAt ?? "0000") <= endDate));
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

function buildMapPosition({ lat, lng }: { lat: number; lng: number }) {
  const x = ((lng - SOUTH_MAP_BOUNDS.minLng) / (SOUTH_MAP_BOUNDS.maxLng - SOUTH_MAP_BOUNDS.minLng)) * 100;
  const y = (1 - (lat - SOUTH_MAP_BOUNDS.minLat) / (SOUTH_MAP_BOUNDS.maxLat - SOUTH_MAP_BOUNDS.minLat)) * 100;

  return {
    x: `${x}%`,
    y: `${y}%`,
  };
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

function buildAttributedRows(total: number, posts: TopPost[]) {
  if (total <= 0) {
    return [];
  }

  const weightedPosts = posts.filter((post) => post.engagementScore > 0);

  if (weightedPosts.length === 0) {
    return [
      {
        id: "carryover",
        title: "Other / carryover audience",
        attributedValue: total,
        post: null,
      },
    ];
  }

  const totalWeight = weightedPosts.reduce((sum, post) => sum + post.engagementScore, 0);
  const seeded = weightedPosts.map((post) => {
    const raw = (post.engagementScore / totalWeight) * total;
    const floor = Math.floor(raw);

    return {
      id: post.id,
      title: post.title,
      attributedValue: floor,
      fractionalRemainder: raw - floor,
      post,
    };
  });

  let remaining = total - seeded.reduce((sum, row) => sum + row.attributedValue, 0);

  seeded
    .slice()
    .sort((a, b) => b.fractionalRemainder - a.fractionalRemainder)
    .forEach((row) => {
      if (remaining <= 0) return;
      const target = seeded.find((candidate) => candidate.id === row.id);
      if (!target) return;
      target.attributedValue += 1;
      remaining -= 1;
    });

  return seeded.sort((a, b) => b.attributedValue - a.attributedValue);
}

function ActivityTooltip({
  active,
  payload,
  label,
  driversByDay,
  valueLabel,
  signalLabel,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
  driversByDay?: Record<string, TopPost[]>;
  valueLabel: string;
  signalLabel?: string;
}) {
  if (!active || !payload?.length || label == null) {
    return null;
  }

  const day = String(label);
  const value = Number(payload[0]?.value ?? 0);
  const drivers = driversByDay?.[day] ?? [];
  const rows = buildAttributedRows(value, drivers);

  return (
    <div
      style={{
        width: 320,
        background: "#0c0c0c",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        boxShadow: "0 14px 40px rgba(0,0,0,0.38)",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{formatShortDate(day)}</div>
      <div style={{ color: "var(--accent)", fontWeight: 700, marginBottom: 12 }}>
        {valueLabel}: {formatCompactNumber(value)}
      </div>

      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        Allocation for chart value
      </div>

      {rows.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <div
              key={`${day}-${row.id}`}
              style={{
                paddingTop: 10,
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: 4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {row.title}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {formatCompactNumber(row.attributedValue)} estimated from chart
                {row.post
                  ? ` / ${formatCompactNumber(row.post.engagementScore)} ${signalLabel ?? "signal"} / ${formatCompactNumber(row.post.likes)} likes / ${formatCompactNumber(row.post.comments)} comments / ${formatCompactNumber(row.post.shares)} shares`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          No post-level movement was captured for this day.
        </div>
      )}
    </div>
  );
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


// Recharts custom tooltip: shows posts driving the metric on a given day
function ChartDayTooltip({
  active, label, payload, dayPostsFn, metric,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number; dataKey?: string; color?: string; name?: string }>;
  dayPostsFn: (day: string) => (TopPost & { platform: Platform })[];
  metric: MetricKey;
}) {
  if (!active || !label) return null;
  const posts = dayPostsFn(label);
  const getVal = (post: TopPost): number => {
    if (metric === "likes") return post.likes ?? 0;
    if (metric === "comments") return post.comments ?? 0;
    if (metric === "shares") return post.shares ?? 0;
    if (metric === "reach") return post.impressions ?? post.views ?? 0;
    return (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
  };
  const dayTotal = payload?.reduce((s, p) => s + (p.value ?? 0), 0) ?? 0;
  const maxVal = Math.max(1, ...posts.map(getVal));
  return (
    <div style={{ background: "#111", border: "1px solid var(--border)", borderRadius: 10, padding: 14, maxWidth: 280, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{formatShortDate(label)}</div>
      <div style={{ color: "var(--accent)", fontWeight: 700, marginBottom: posts.length ? 10 : 0, fontSize: 13 }}>
        {formatCompactNumber(dayTotal)} {metric}
      </div>
      {posts.map((post) => {
        const val = getVal(post);
        const pct = Math.max(4, Math.round((val / maxVal) * 100));
        return (
          <div key={post.platform + post.id} style={{ marginBottom: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, fontSize: 11 }}>
                {post.title || "Untitled"}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 10, flexShrink: 0, marginLeft: 6 }}>
                {formatCompactNumber(val)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: PLATFORM_COLORS[post.platform], borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniSparkline({ data, color, includeZero = true, activityDrivers, metric, platform }: { data: DataPoint[]; color: string; includeZero?: boolean; activityDrivers?: { [day: string]: TopPost[] }; metric?: MetricKey; platform?: Platform }) {
  const yDomain = useMemo(() => getNumericDomain(data.map(d => d.value), includeZero), [data, includeZero]);
  if (data.length === 0) {
    return <div style={{ height: 56, color: "var(--text-muted)", fontSize: 12 }}>No trend yet</div>;
  }

  return (
    <div style={{ width: "100%", height: 110 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 6, bottom: 4 }}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickFormatter={(v: string) => { const d = new Date(v + "T00:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            width={36}
            tickFormatter={(v: number) => formatCompactNumber(v)}
          />
          {activityDrivers && metric && metric !== "followers" ? (
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
              wrapperStyle={{ zIndex: 200 }}
              content={(rProps) => (
                <ChartDayTooltip
                  active={rProps.active}
                  label={String(rProps.label ?? "")}
                  payload={rProps.payload as Array<{ value?: number; dataKey?: string; color?: string; name?: string }>}
                  metric={metric}
                  dayPostsFn={(day) => {
                    const posts = (activityDrivers[day] ?? []) as TopPost[];
                    return posts
                      .map((p) => ({ ...p, platform: (platform ?? "facebook") as Platform }))
                      .sort((a, b) => {
                        const v = (post: TopPost): number => {
                          if (metric === "likes") return post.likes ?? 0;
                          if (metric === "comments") return post.comments ?? 0;
                          if (metric === "shares") return post.shares ?? 0;
                          if (metric === "reach") return post.impressions ?? post.views ?? 0;
                          return (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
                        };
                        return v(b) - v(a);
                      });
                  }}
                />
              )}
            />
          ) : (
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
              wrapperStyle={{ background: "transparent", border: "none" }}
              contentStyle={{ background: "#111", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, padding: "5px 10px" }}
              labelFormatter={(v: string) => { const d = new Date(v + "T00:00:00"); return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }}
              formatter={(v: unknown) => [formatCompactNumber(Number(v)), "total"]}
            />
          )}
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
  onMetricChange,
  metric = "followers" as MetricKey,
  includeZero = true,
  days = 365,
  endDate = "",
  allData,
}: {
  summary: Summary;
  onSelect?: (platform: Platform) => void;
  onMetricChange?: (m: MetricKey) => void;
  metric?: MetricKey;
  includeZero?: boolean;
  days?: number;
  endDate?: string;
  allData?: DashboardPayload;
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

      {(() => {
        // Compute big-number value + delta + label based on active metric
        let bigVal = 0;
        let bigDelta = 0;
        let bigLabel = "";
        if (metric === "followers") {
          bigVal = summary.latestFollowers;
          bigDelta = summary.deltaFollowers;
          bigLabel = "followers";
        } else if (metric === "reach") {
          const pts = filterDays(summary.performanceTrend, days, endDate);
          bigVal = pts.reduce((s, p) => s + p.value, 0);
          const half = Math.floor(pts.length / 2);
          const recent = pts.slice(half).reduce((s, p) => s + p.value, 0);
          const prior = pts.slice(0, half).reduce((s, p) => s + p.value, 0);
          bigDelta = recent - prior;
          bigLabel = "total reach / views";
        } else {
          const drivers = (allData?.platforms[summary.platform]?.activityDrivers ?? {}) as { [k: string]: TopPost[] };
          const trendPts = buildMetricTrend(drivers, metric as "likes" | "comments" | "shares");
          const pts = filterDays(trendPts, days, endDate);
          bigVal = pts.reduce((s, p) => s + p.value, 0);
          const half = Math.floor(pts.length / 2);
          const recent = pts.slice(half).reduce((s, p) => s + p.value, 0);
          const prior = pts.slice(0, half).reduce((s, p) => s + p.value, 0);
          bigDelta = recent - prior;
          bigLabel = "total " + metric;
        }
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "end", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{formatCompactNumber(bigVal)}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{bigLabel}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: bigDelta >= 0 ? "#86efac" : "#fca5a5", fontWeight: 700 }}>{formatDelta(bigDelta)}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>tracked period</div>
            </div>
          </div>
        );
      })()}

      {(() => {
        const engFields: (keyof TopPost)[] = ["likes", "comments", "shares"];
        let sparkData: DataPoint[];
        if (metric === "followers") sparkData = summary.followersTrend;
        else if (metric === "reach") sparkData = summary.performanceTrend;
        else {
          const drivers = (allData?.platforms[summary.platform]?.activityDrivers ?? {}) as { [k: string]: TopPost[] };
          sparkData = buildMetricTrend(drivers, metric as "likes" | "comments" | "shares");
        }
        void engFields;
        return <MiniSparkline
            data={filterDays(sparkData, days, endDate)}
            color={color}
            includeZero={includeZero}
            activityDrivers={(allData?.platforms[summary.platform]?.activityDrivers ?? {}) as { [day: string]: TopPost[] }}
            metric={metric}
            platform={summary.platform}
          />;
      })()}

      {(() => {
        const posts = filterPostDays(allData?.platforms[summary.platform]?.topPosts ?? [], days, endDate);
        const engTotal = (field: "likes" | "comments" | "shares") =>
          posts.reduce((s, p) => s + (p[field] as number), 0);
        const reachTotal = filterDays(summary.performanceTrend, days, endDate).reduce((s, p) => s + p.value, 0);
        const allBottomMetrics: { key: MetricKey; label: string; val: number }[] = [
          { key: "followers", label: "Followers", val: summary.latestFollowers },
          { key: "reach",     label: "Reach",     val: reachTotal },
          { key: "likes",     label: "Likes",     val: engTotal("likes") },
          { key: "comments",  label: "Cmts",      val: engTotal("comments") },
          { key: "shares",    label: "Shares",    val: engTotal("shares") },
        ];
        const bottomMetrics = allBottomMetrics.filter(({ key }) => key !== metric);
        return (
          <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            {bottomMetrics.map(({ key, label, val }) => (
              <div key={key}
                onClick={(e) => { e.stopPropagation(); onMetricChange?.(key); }}
                style={{ flex: "1 1 auto", minWidth: 48, cursor: onMetricChange ? "pointer" : "default" }}
              >
                <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 13, transition: "color 0.1s" }}>{formatCompactNumber(val)}</div>
              </div>
            ))}
          </div>
        );
      })()}
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

function CombinedTrendTile({ data, allData, includeZero = true, metric = "followers" as MetricKey, days = 365, endDate = "", onMetricChange }: { data: TrendPoint[]; allData: DashboardPayload; includeZero?: boolean; metric?: MetricKey; days?: number; endDate?: string; onMetricChange?: (m: MetricKey) => void }) {
  const chartData = useMemo(() => {
    const map: { [day: string]: TrendPoint } = {};
    const source: { [p: string]: DataPoint[] } = {};
    if (metric === "followers") {
      (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
        source[p] = allData.platforms[p].followersTrend ?? [];
      });
    } else if (metric === "reach") {
      (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
        source[p] = allData.platforms[p].performanceTrend ?? [];
      });
    } else {
      const field = metric as "likes" | "comments" | "shares";
      (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
        const drivers = (allData.platforms[p].activityDrivers ?? {}) as { [k: string]: TopPost[] };
        source[p] = buildMetricTrend(drivers, field);
      });
    }
    (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
      (source[p] ?? []).forEach(({ day, value }) => {
        if (!map[day]) map[day] = { day, facebook: null, instagram: null, tiktok: null };
        map[day][p] = value;
      });
    });
    return filterTrendDays(Object.values(map).sort((a, b) => a.day.localeCompare(b.day)), days, endDate);
  }, [allData, metric, days, endDate]);

  const yDomain = useMemo(
    () => getNumericDomain(
      chartData.flatMap((p) => [p.facebook, p.instagram, p.tiktok].filter((v): v is number => v !== null)),
      includeZero
    ),
    [chartData, includeZero]
  );


  // Big number + delta across all platforms for selected metric
  const bigTotal = useMemo(() => {
    let total = 0;
    let delta = 0;
    (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
      let pts: DataPoint[] = [];
      if (metric === "followers") pts = filterDays(allData.platforms[p].followersTrend ?? [], days, endDate);
      else if (metric === "reach") pts = filterDays(allData.platforms[p].performanceTrend ?? [], days, endDate);
      else {
        const drivers = (allData.platforms[p].activityDrivers ?? {}) as { [k: string]: TopPost[] };
        pts = filterDays(buildMetricTrend(drivers, metric as "likes" | "comments" | "shares"), days, endDate);
      }
      const sum = pts.reduce((s, pt) => s + pt.value, 0);
      total += metric === "followers" ? (allData.platforms[p].followersTrend?.slice(-1)[0]?.value ?? 0) : sum;
      const half = Math.floor(pts.length / 2);
      delta += pts.slice(half).reduce((s, pt) => s + pt.value, 0) - pts.slice(0, half).reduce((s, pt) => s + pt.value, 0);
    });
    return { total, delta };
  }, [allData, metric, days, endDate]);

  const metricLabel: Record<MetricKey, string> = { followers: "total followers", reach: "total reach / views", likes: "total likes", comments: "total comments", shares: "total shares" };

  // Bottom stats: all metrics except selected
  const bottomTotals = useMemo(() => {
    const engTotals: { [k: string]: number } = { likes: 0, comments: 0, shares: 0 };
    let reachTotal = 0;
    let followersTotal = 0;
    (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
      const posts = filterPostDays(allData.platforms[p].topPosts, days, endDate);
      (["likes", "comments", "shares"] as const).forEach((f) => {
        engTotals[f] += posts.reduce((s, post) => s + post[f], 0);
      });
      reachTotal += filterDays(allData.platforms[p].performanceTrend ?? [], days, endDate).reduce((s, pt) => s + pt.value, 0);
      followersTotal += allData.platforms[p].followersTrend?.slice(-1)[0]?.value ?? 0;
    });
    const all: { key: MetricKey; label: string; val: number }[] = [
      { key: "followers", label: "Followers", val: followersTotal },
      { key: "reach",     label: "Reach",     val: reachTotal },
      { key: "likes",     label: "Likes",     val: engTotals.likes },
      { key: "comments",  label: "Cmts",      val: engTotals.comments },
      { key: "shares",    label: "Shares",    val: engTotals.shares },
    ];
    return all.filter(({ key }) => key !== metric);
  }, [allData, metric, days, endDate]);

  return (
    <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header: dots beside each platform name */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>All Platforms</div>
        <div style={{ display: "flex", gap: 12 }}>
          {(Object.keys(PLATFORM_COLORS) as Platform[]).map((p) => (
            <span key={p} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: PLATFORM_COLORS[p], display: "inline-block", flexShrink: 0 }} />
              {PLATFORM_LABELS[p]}
            </span>
          ))}
        </div>
      </div>

      {/* Big number + delta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "end", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{formatCompactNumber(bigTotal.total)}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{metricLabel[metric]}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: bigTotal.delta >= 0 ? "#86efac" : "#fca5a5", fontWeight: 700 }}>{formatDelta(bigTotal.delta)}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>tracked period</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 2, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={formatShortDate} interval="preserveStartEnd" minTickGap={40} />
            <YAxis domain={yDomain} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompactNumber(v)} width={36} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
              wrapperStyle={{ zIndex: 200 }}
              content={(rProps) => (
                <ChartDayTooltip
                  active={rProps.active}
                  label={String(rProps.label ?? "")}
                  payload={rProps.payload as Array<{ value?: number; dataKey?: string; color?: string; name?: string }>}
                  metric={metric}
                  dayPostsFn={(day) => {
                    const merged: (TopPost & { platform: Platform })[] = [];
                    (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
                      const drivers = (allData.platforms[p].activityDrivers ?? {}) as { [d: string]: TopPost[] };
                      (drivers[day] ?? []).forEach((post) => merged.push({ ...post, platform: p }));
                    });
                    const getV = (post: TopPost): number => {
                      if (metric === "likes") return post.likes ?? 0;
                      if (metric === "comments") return post.comments ?? 0;
                      if (metric === "shares") return post.shares ?? 0;
                      if (metric === "reach") return post.impressions ?? post.views ?? 0;
                      return (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
                    };
                    return merged.sort((a, b) => getV(b) - getV(a));
                  }}
                />
              )}
            />
            {(Object.keys(PLATFORM_COLORS) as Platform[]).map((p) => (
              <Line key={p} type="monotone" dataKey={p} stroke={PLATFORM_COLORS[p]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom stats: all metrics except selected */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        {bottomTotals.map(({ key, label, val }) => (
          <div key={key}
            onClick={() => onMetricChange?.(key)}
            style={{ flex: "1 1 auto", minWidth: 48, cursor: onMetricChange ? "pointer" : "default" }}
          >
            <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 2 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{formatCompactNumber(val)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ---- Posting Calendar ----
function PostingCalendarCard({ data, metric = "reach", days = 365, endDate = "" }: { data: DashboardPayload; metric?: MetricKey; days?: number; endDate?: string }) {
  const [calHov, setCalHov] = useState<{ date: string; x: number; y: number } | null>(null);

  const calendarMap = useMemo(() => {
    const map: { [d: string]: { count: number; value: number; platforms: Platform[] } } = {};
    const cut = days < 365 ? getCutoff(days) : "0000-00-00";
    const capDate = endDate || "9999-99-99";
    (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
      if (metric === "likes" || metric === "comments" || metric === "shares") {
        // Sum engagement metric per day from activity drivers
        const drivers = (data.platforms[p].activityDrivers ?? {}) as { [k: string]: TopPost[] };
        Object.entries(drivers).forEach(([day, posts]) => {
          if (day < cut) return;
          if (day > capDate) return;
          if (!map[day]) map[day] = { count: 0, value: 0, platforms: [] };
          map[day].count += posts.length;
          map[day].value += posts.reduce((s, post) => s + (post[metric] as number), 0);
          if (!map[day].platforms.includes(p)) map[day].platforms.push(p);
        });
      } else if (metric === "reach") {
        // Use performanceTrend (daily reach/views) for each platform
        (data.platforms[p].performanceTrend ?? []).forEach(({ day, value }) => {
          if (day < cut) return;
          if (day > capDate) return;
          if (!map[day]) map[day] = { count: 0, value: 0, platforms: [] };
          map[day].value += value;
          if (!map[day].platforms.includes(p)) map[day].platforms.push(p);
        });
      } else {
        // followers: use followersTrend delta (show absolute value)
        (data.platforms[p].followersTrend ?? []).forEach(({ day, value }) => {
          if (day < cut) return;
          if (day > capDate) return;
          if (!map[day]) map[day] = { count: 0, value: 0, platforms: [] };
          map[day].value += value;
          if (!map[day].platforms.includes(p)) map[day].platforms.push(p);
        });
      }
    });
    return map;
  }, [data, metric, days, endDate]);

  const maxValue = useMemo(() => Math.max(1, ...Object.values(calendarMap).map((v) => v.value)), [calendarMap]);

  const months = useMemo(() => {
    const today = new Date();
    // Find start date: for all-time, use earliest data point; otherwise use cutoff
    let startStr: string;
    if (days >= 365) {
      const allDays = Object.keys(calendarMap).sort();
      startStr = allDays.length > 0 ? allDays[0] : getCutoff(90);
    } else {
      startStr = getCutoff(days);
    }
    const startDate = new Date(startStr + "T12:00:00");
    const result: { monthName: string; cells: { date: string; dayNum: number; tip: string }[] }[] = [];
    let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endYear = today.getFullYear();
    const endMonth = today.getMonth();
    while (cur.getFullYear() < endYear || (cur.getFullYear() === endYear && cur.getMonth() <= endMonth)) {
      const year = cur.getFullYear();
      const month = cur.getMonth();
      const monthName = cur.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDow = new Date(year, month, 1).getDay();
      const cells: { date: string; dayNum: number; tip: string }[] = [];
      for (let i = 0; i < firstDow; i++) cells.push({ date: "", dayNum: 0, tip: "" });
      for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(month + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        const date = year + "-" + mm + "-" + dd;
        const tip = new Date(year, month, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        cells.push({ date, dayNum: d, tip });
      }
      result.push({ monthName, cells });
      cur = new Date(year, month + 1, 1);
    }
    return result;
  }, [days, calendarMap]);

  const hovPosts = useMemo(() => {
    if (!calHov) return null;
    const byPlatform: { platform: Platform; posts: TopPost[] }[] = [];
    (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
      const drivers = (data.platforms[p].activityDrivers ?? {}) as { [k: string]: TopPost[] };
      const posts = drivers[calHov.date] ?? [];
      if (posts.length > 0) byPlatform.push({ platform: p, posts });
    });
    return byPlatform.length > 0 ? byPlatform : null;
  }, [calHov, data]);

  const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="card" style={{ padding: 24, marginBottom: 24, position: "relative" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        {metric === "comments" ? "Comment Activity Calendar"
          : metric === "likes" ? "Like Activity Calendar"
          : metric === "shares" ? "Share Activity Calendar"
          : metric === "reach" ? "Reach Calendar"
          : "Follower Growth Calendar"}
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        {(metric === "likes" || metric === "comments" || metric === "shares") ? `Daily ${metric} across all platforms` : `Post activity across all platforms`}
        {" — "}{days >= 365 ? "all time" : days <= 7 ? "last 7 days" : days <= 30 ? "last 30 days" : `last ${days} days`}
      </p>
      {days <= 7 ? (
        // Week view: large day cells spanning full width
        (() => {
          const today = new Date();
          const weekDays: { date: string; label: string }[] = [];
          for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            const date = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            weekDays.push({ date, label });
          }
          const wMax = Math.max(1, ...weekDays.map((w) => calendarMap[w.date]?.value ?? 0));
          return (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${weekDays.length}, 1fr)`, gap: 8 }}>
              {weekDays.map(({ date }) => {
                const entry = calendarMap[date];
                const intensity = entry ? entry.value / wMax : 0;
                const bg = entry ? "rgba(255,107,53," + Math.max(0.2, intensity) + ")" : "rgba(255,255,255,0.04)";
                return (
                  <div
                    key={date}
                    onMouseEnter={(e) => {
                      if (entry) {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setCalHov({ date, x: rect.left, y: rect.bottom });
                      }
                    }}
                    onMouseLeave={() => setCalHov(null)}
                    style={{ background: bg, borderRadius: 8, padding: "14px 8px", textAlign: "center", cursor: entry ? "pointer" : "default", minHeight: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <div style={{ fontSize: 11, color: entry ? "rgba(255,255,255,0.7)" : "var(--text-muted)", fontWeight: 600 }}>
                      {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: entry ? "#fff" : "var(--text-muted)" }}>
                      {new Date(date + "T12:00:00").getDate()}
                    </div>
                    {entry && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                        {formatCompactNumber(entry.value)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: months.length === 1 ? "minmax(0,360px)" : months.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 24 }}>
        {months.map(({ monthName, cells }) => (
          <div key={monthName}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#fff" }}>{monthName}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
              {DOW.map((d) => (
                <div key={d} style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {cells.map((cell, i) => {
                if (!cell.date) return <div key={"b" + i} />;
                const entry = calendarMap[cell.date];
                const intensity = entry ? entry.value / maxValue : 0;
                const bg = entry ? "rgba(255,107,53," + Math.max(0.25, intensity) + ")" : "rgba(255,255,255,0.04)";
                return (
                  <div
                    key={cell.date}
                    onMouseEnter={(e) => {
                      if (entry) {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setCalHov({ date: cell.date, x: rect.left, y: rect.bottom });
                      }
                    }}
                    onMouseLeave={() => setCalHov(null)}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 3,
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: entry ? "rgba(255,255,255,0.85)" : "var(--text-muted)",
                      cursor: entry ? "pointer" : "default",
                    }}
                  >
                    {cell.dayNum > 0 ? cell.dayNum : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 16, fontSize: 11, color: "var(--text-muted)" }}>
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <div key={t} style={{ width: 12, height: 12, borderRadius: 2, background: t === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,107,53," + Math.max(0.25, t) + ")" }} />
        ))}
        <span>More {(metric === "likes" || metric === "comments" || metric === "shares") ? metric : "posts"}</span>
      </div>


      {/* ── Post Activity Table ─────────────────────────────────────── */}
      {(() => {
        // Collect all unique posts across platforms in the date range
        const allPosts: (TopPost & { platform: Platform })[] = [];
        (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
          const drivers = (data.platforms[p].activityDrivers ?? {}) as { [d: string]: TopPost[] };
          const seen = new Set<string>();
          Object.values(drivers).forEach((dayPosts) => {
            dayPosts.forEach((post) => {
              if (!seen.has(post.id)) {
                seen.add(post.id);
                allPosts.push({ ...post, platform: p });
              }
            });
          });
        });

        // Filter to date range
        const cut = days < 365 ? getCutoff(days) : "0000-00-00";
        const cap = endDate || "9999-99-99";
        const filteredPosts = allPosts.filter((p) => {
          const d = p.createdAt ?? "9999";
          return d >= cut && d <= cap;
        });

        // Collect all active dates in range, sorted
        const activeDates = Array.from(new Set(
          (["facebook", "instagram", "tiktok"] as Platform[]).flatMap((p) =>
            Object.keys((data.platforms[p].activityDrivers ?? {}) as { [d: string]: TopPost[] })
          )
        )).filter((d) => d >= cut && d <= cap).sort();

        if (filteredPosts.length === 0 || activeDates.length === 0) return null;

        const getVal = (post: TopPost): number => {
          if (metric === "likes") return post.likes ?? 0;
          if (metric === "comments") return post.comments ?? 0;
          if (metric === "shares") return post.shares ?? 0;
          if (metric === "reach") return post.impressions ?? post.views ?? 0;
          return 0;
        };

        // Build lookup: postId -> { [date]: value }
        const postDateMap: Record<string, Record<string, number>> = {};
        (["facebook", "instagram", "tiktok"] as Platform[]).forEach((p) => {
          const drivers = (data.platforms[p].activityDrivers ?? {}) as { [d: string]: TopPost[] };
          Object.entries(drivers).forEach(([day, posts]) => {
            if (day < cut || day > cap) return;
            posts.forEach((post) => {
              if (!postDateMap[post.id]) postDateMap[post.id] = {};
              postDateMap[post.id][day] = getVal(post);
            });
          });
        });

        // Sort posts by total metric desc
        filteredPosts.sort((a, b) => {
          const aTotal = Object.values(postDateMap[a.id] ?? {}).reduce((s, v) => s + v, 0);
          const bTotal = Object.values(postDateMap[b.id] ?? {}).reduce((s, v) => s + v, 0);
          return bTotal - aTotal;
        });

        const cellW = 52;
        const fixedW = 320;

        return (
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#fff" }}>
              Post Activity by Date
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, background: "#0a0a0a", zIndex: 2, width: fixedW, minWidth: fixedW, textAlign: "left", padding: "6px 10px 6px 0", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                      Post
                    </th>
                    <th style={{ position: "sticky", left: fixedW - 80, background: "#0a0a0a", zIndex: 2, width: 80, minWidth: 80, textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                      Date
                    </th>
                    <th style={{ position: "sticky", left: fixedW, background: "#0a0a0a", zIndex: 2, width: 72, minWidth: 72, textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                      Platform
                    </th>
                    {activeDates.map((d) => (
                      <th key={d} style={{ minWidth: cellW, width: cellW, textAlign: "center", padding: "6px 4px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                        {new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((post, idx) => {
                    const rowBg = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)";
                    return (
                      <tr key={post.platform + post.id} style={{ background: rowBg }}>
                        <td style={{ position: "sticky", left: 0, background: idx % 2 === 0 ? "#0a0a0a" : "#0d0d0d", zIndex: 1, padding: "7px 10px 7px 0", borderRight: "1px solid var(--border)", maxWidth: fixedW - 80, overflow: "hidden" }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#ddd", maxWidth: fixedW - 90 }}>
                            {post.title || "Untitled"}
                          </span>
                        </td>
                        <td style={{ position: "sticky", left: fixedW - 80, background: idx % 2 === 0 ? "#0a0a0a" : "#0d0d0d", zIndex: 1, padding: "7px 8px", borderRight: "1px solid var(--border)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {post.createdAt ? new Date(post.createdAt + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td style={{ position: "sticky", left: fixedW, background: idx % 2 === 0 ? "#0a0a0a" : "#0d0d0d", zIndex: 1, padding: "7px 8px", borderRight: "1px solid var(--border)", textAlign: "center" }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: PLATFORM_COLORS[post.platform] }} />
                        </td>
                        {activeDates.map((d) => {
                          const val = postDateMap[post.id]?.[d];
                          return (
                            <td key={d} style={{ textAlign: "center", padding: "7px 4px", color: val ? "#fff" : "var(--text-muted)", fontWeight: val ? 700 : 400, fontSize: val ? 12 : 10 }}>
                              {val ? formatCompactNumber(val) : "·"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {calHov && calendarMap[calHov.date] && (() => {
        // Flatten all posts for this day, sorted by selected metric desc
        const getMetricVal = (post: TopPost) => {
          if (metric === "likes") return post.likes;
          if (metric === "comments") return post.comments;
          if (metric === "shares") return post.shares;
          if (metric === "reach") return post.impressions ?? post.views ?? 0;
          return post.likes + post.comments + post.shares;
        };
        const allDayPosts: (TopPost & { platform: Platform })[] = [];
        (hovPosts ?? []).forEach(({ platform, posts }) => posts.forEach((p) => allDayPosts.push({ ...p, platform })));
        allDayPosts.sort((a, b) => getMetricVal(b) - getMetricVal(a));
        const maxVal = Math.max(1, ...allDayPosts.map(getMetricVal));
        const metricLabel = metric === "followers" ? "followers" : metric === "reach" ? "reach" : metric;
        return (
          <div style={{
            position: "fixed",
            left: Math.min(calHov.x, (typeof window !== "undefined" ? window.innerWidth : 900) - 320),
            top: calHov.y + 8,
            width: 300,
            background: "#111",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 14,
            zIndex: 1000,
            pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{formatShortDate(calHov.date)}</div>
            <div style={{ color: "var(--accent)", fontWeight: 700, marginBottom: 10, fontSize: 13 }}>
              {formatCompactNumber(calendarMap[calHov.date]?.value ?? 0)} total {metricLabel}
            </div>
            {(hovPosts ?? []).length > 0 && allDayPosts.map((post) => {
              const val = getMetricVal(post);
              const pct = Math.max(4, Math.round((val / maxVal) * 100));
              return (
                <div key={post.platform + post.id} style={{ marginBottom: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, fontSize: 11 }}>
                      {post.title || "Untitled"}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: 10, flexShrink: 0, marginLeft: 6 }}>
                      {formatCompactNumber(val)}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: PLATFORM_COLORS[post.platform], borderRadius: 3, transition: "width 0.2s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
// ---- Top Posts by Platform ----
function AllTopPostsCard({ data, days = 365, metric = "reach", endDate = "" }: { data: DashboardPayload; days?: number; metric?: MetricKey; endDate?: string }) {
  const allPlatforms: Platform[] = ["facebook", "instagram", "tiktok"];
  const [active, setActive] = useState<Platform[]>(["facebook", "instagram", "tiktok"]);
  const [sortBy, setSortBy] = useState<string>(metric);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hovered, setHovered] = useState<{ platform: Platform; postId: string; col: string; x: number; y: number } | null>(null);

  // Sync sortBy when global metric changes
  useEffect(() => {
    setSortBy(metric);
    setSortDir("desc");
  }, [metric]);

  const secondaryVal = (platform: Platform, post: TopPost) =>
    platform === "instagram" ? post.saves : platform === "facebook" ? post.impressions : post.views;

  const allPosts = useMemo(() => {
    const combined: (TopPost & { platform: Platform })[] = [];
    allPlatforms.forEach((p) => {
      if (active.includes(p)) {
        filterPostDays(data.platforms[p].topPosts, days, endDate).forEach((post) => combined.push({ ...post, platform: p }));
      }
    });
    combined.sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (sortBy === "date") {
        av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (sortBy === "likes") {
        av = a.likes; bv = b.likes;
      } else if (sortBy === "comments") {
        av = a.comments; bv = b.comments;
      } else if (sortBy === "shares") {
        av = a.shares; bv = b.shares;
      } else if (sortBy === "secondary") {
        av = secondaryVal(a.platform, a);
        bv = secondaryVal(b.platform, b);
      } else if (sortBy === "reach" || sortBy === "followers") {
        av = a.likes + a.comments + a.shares;
        bv = b.likes + b.comments + b.shares;
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return combined;
  }, [data, active, allPlatforms, sortBy, sortDir, days, endDate]);

  // Build per-day data for a given post + column metric
  const hoveredDailyData = useMemo(() => {
    if (!hovered) return [];
    const drivers = (data.platforms[hovered.platform].activityDrivers ?? {}) as { [k: string]: TopPost[] };
    const col = hovered.col;
    const points: { day: string; value: number }[] = [];
    Object.entries(drivers).forEach(([day, posts]) => {
      const post = posts.find((p) => p.id === hovered.postId);
      if (!post) return;
      let val = 0;
      if (col === "likes") val = post.likes;
      else if (col === "comments") val = post.comments;
      else if (col === "shares") val = post.shares;
      else if (col === "secondary") val = secondaryVal(hovered.platform, post);
      else val = post.likes + post.comments + post.shares;
      points.push({ day, value: val });
    });
    points.sort((a, b) => a.day.localeCompare(b.day));
    return points;
  }, [hovered, data]);

  const togglePlatform = (p: Platform) => {
    setActive((prev) => {
      if (prev.includes(p)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== p);
      }
      return [...prev, p];
    });
  };

  const toggleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const sortIcon = (key: string) => {
    if (sortBy !== key) return " ↕";
    return sortDir === "desc" ? " ↓" : " ↑";
  };

  const colStyle = (key: string): React.CSSProperties => ({
    textAlign: "right",
    padding: "6px 8px",
    color: sortBy === key ? "var(--accent)" : "var(--text-muted)",
    fontWeight: 600,
    fontSize: 11,
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
    userSelect: "none" as const,
  });

  const colLabel: { [k: string]: string } = {
    likes: "Likes", comments: "Comments", shares: "Shares", secondary: "Views/Saves/Impr.",
  };

  return (
    <div className="card" style={{ padding: 24, marginBottom: 24, position: "relative" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Posts by Platform</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Sorted by active metric. Hover any metric cell for daily breakdown. Click headers to re-sort.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {allPlatforms.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => togglePlatform(p)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid " + (active.includes(p) ? PLATFORM_COLORS[p] : "var(--border)"),
              background: active.includes(p) ? PLATFORM_COLORS[p] + "22" : "transparent",
              color: active.includes(p) ? PLATFORM_COLORS[p] : "var(--text-muted)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {PLATFORM_LABELS[p]}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>
          {allPosts.length} posts
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>Post</th>
              <th onClick={() => toggleSort("date")} style={colStyle("date")}>Date{sortIcon("date")}</th>
              <th onClick={() => toggleSort("likes")} style={colStyle("likes")}>Likes{sortIcon("likes")}</th>
              <th onClick={() => toggleSort("comments")} style={colStyle("comments")}>Comments{sortIcon("comments")}</th>
              <th onClick={() => toggleSort("shares")} style={colStyle("shares")}>Shares{sortIcon("shares")}</th>
              <th onClick={() => toggleSort("secondary")} style={colStyle("secondary")}>Views/Saves/Impr.{sortIcon("secondary")}</th>
            </tr>
          </thead>
          <tbody>
            {allPosts.map((post) => {
              const color = PLATFORM_COLORS[post.platform];
              return (
                <tr
                  key={post.platform + "-" + post.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "default" }}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td style={{ padding: "8px 8px", maxWidth: 280 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      {post.imageUrl && (
                        <img src={post.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
                      )}
                      <span style={{ color: "var(--text-muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {post.title || "—"}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 12 }}>
                    {post.createdAt ? post.createdAt.slice(0, 10) : "—"}
                  </td>
                  {(["likes", "comments", "shares", "secondary"] as string[]).map((col) => {
                    const val = col === "likes" ? post.likes : col === "comments" ? post.comments : col === "shares" ? post.shares : secondaryVal(post.platform, post);
                    const isHov = hovered?.postId === post.id && hovered?.platform === post.platform && hovered?.col === col;
                    return (
                      <td
                        key={col}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setHovered({ platform: post.platform, postId: post.id, col, x: rect.left, y: rect.bottom });
                        }}
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontWeight: 600,
                          background: isHov ? "rgba(255,107,53,0.12)" : undefined,
                          color: col === "secondary" ? "var(--text-muted)" : undefined,
                          cursor: "crosshair",
                          transition: "background 0.1s",
                        }}
                      >
                        {formatCompactNumber(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {allPosts.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No posts.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hovered && (() => {
        const hovPost = allPosts.find((p) => p.id === hovered.postId && p.platform === hovered.platform);
        const pColor = PLATFORM_COLORS[hovered.platform];

        const winW = typeof window !== "undefined" ? window.innerWidth : 800;
        const winH = typeof window !== "undefined" ? window.innerHeight : 600;
        const tipW = 320;
        const tipLeft = Math.min(hovered.x, winW - tipW - 8);
        // flip above row if near bottom of screen
        const spaceBelow = winH - hovered.y;
        const tipTop = spaceBelow < 420 ? hovered.y - 420 : hovered.y + 8;
        const allMetrics: { key: string; label: string; val: number }[] = [
          { key: "likes",    label: "Likes",    val: hovPost?.likes ?? 0 },
          { key: "comments", label: "Comments", val: hovPost?.comments ?? 0 },
          { key: "shares",   label: "Shares",   val: hovPost?.shares ?? 0 },
          { key: "views",    label: "Views",    val: hovPost?.views ?? 0 },
          { key: "saves",    label: "Saves",    val: hovPost?.saves ?? 0 },
          { key: "impressions", label: "Impressions", val: hovPost?.impressions ?? 0 },
        ].filter(({ val }) => val > 0);
        return (
          <div style={{
            position: "fixed",
            left: tipLeft,
            top: tipTop,
            width: tipW,
            background: "#111",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            zIndex: 1000,
            pointerEvents: "none",
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
          }}>
            {/* Thumbnail */}
            {hovPost?.imageUrl && (
              <img
                src={hovPost.imageUrl}
                alt=""
                style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
              />
            )}
            <div style={{ padding: 14 }}>
              {/* Platform + date */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: pColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: pColor, fontWeight: 700 }}>{PLATFORM_LABELS[hovered.platform]}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>·</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {hovPost?.createdAt ? new Date(hovPost.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </span>
              </div>

              {/* Title / caption */}
              {hovPost?.title && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 12, lineHeight: 1.5, maxHeight: 54, overflow: "hidden" }}>
                  {hovPost.title}
                </div>
              )}

              {/* All metrics grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                {allMetrics.map(({ key, label, val }) => (
                  <div key={key} style={{ background: key === hovered.col ? pColor + "22" : "rgba(255,255,255,0.04)", borderRadius: 6, padding: "6px 8px" }}>
                    <div style={{ fontSize: 9, color: key === hovered.col ? pColor : "var(--text-muted)", fontWeight: 600, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: key === hovered.col ? pColor : "#fff" }}>{formatCompactNumber(val)}</div>
                  </div>
                ))}
              </div>

              {/* Trend chart */}
              {hoveredDailyData.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                    {colLabel[hovered.col] ?? hovered.col} by day
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={hoveredDailyData} margin={{ left: 28, right: 8, top: 4, bottom: 16 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickFormatter={(d: string) => { const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }}
                        tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={30}
                      />
                      <YAxis
                        tickFormatter={(v: number) => formatCompactNumber(v)}
                        tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                        tickLine={false}
                        axisLine={false}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                        formatter={(v: number) => [formatCompactNumber(v), colLabel[hovered.col] ?? hovered.col]}
                        labelFormatter={(l: string) => { const dt = new Date(l + "T12:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }}
                      />
                      <Line type="monotone" dataKey="value" stroke={pColor} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
function TrendCard({
  title,
  note,
  series,
  color,
  allowZeroToggle = false,
  driversByDay,
  valueLabel,
  xAxisLabel = "Date",
  yAxisLabel,
  driverSignalLabel,
}: {
  title: string;
  note?: string;
  series: DataPoint[];
  color: string;
  allowZeroToggle?: boolean;
  driversByDay?: Record<string, TopPost[]>;
  valueLabel?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  driverSignalLabel?: string;
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
            label={{
              value: xAxisLabel,
              position: "insideBottom",
              offset: -2,
              fill: "var(--text-muted)",
              fontSize: 12,
            }}
          />
          <YAxis
            domain={yDomain}
            stroke="var(--text-muted)"
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => formatCompactNumber(value)}
            width={64}
            label={{
              value: yAxisLabel ?? title,
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-muted)",
              fontSize: 12,
              dx: -8,
            }}
          />
          <Tooltip
            content={
              driversByDay
                ? ({ active, payload, label }) => (
                    <ActivityTooltip
                      active={active}
                      payload={payload as Array<{ value?: number | string }>}
                      label={label}
                      driversByDay={driversByDay}
                      valueLabel={valueLabel ?? title}
                      signalLabel={driverSignalLabel}
                    />
                  )
                : undefined
            }
            contentStyle={{
              background: "#0c0c0c",
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
                  background: "#0c0c0c",
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
                  {formatCompactNumber(item.avgEngagement)} avg engagements / {formatCompactNumber(item.avgSaves)} saves
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

function DistributionList({
  title,
  items,
  color,
  maxItems,
}: {
  title: string;
  items: BreakdownDatum[];
  color: string;
  maxItems?: number;
}) {
  const rows = buildPercentageRows(items);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {rows.slice(0, maxItems ?? rows.length).map((row) => (
        <div
          key={`${title}-${row.label}`}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {row.label}
            </div>
            <div
              style={{
                marginTop: 6,
                width: "100%",
                height: 10,
                borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(row.percent, 1)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: color,
                }}
              />
            </div>
          </div>
          <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>{formatPercent(row.percent)}</div>
        </div>
      ))}
    </div>
  );
}

function AudienceMapPanel({ cities }: { cities: BreakdownDatum[] }) {
  const mappedCities = cities
    .map((city) => {
      const coords = getCityCoordinates(city.label);
      if (!coords) return null;

      return {
        ...city,
        ...buildMapPosition(coords),
      };
    })
    .filter((city): city is BreakdownDatum & { x: string; y: string } => city !== null);

  const maxValue = Math.max(...mappedCities.map((city) => city.value), 1);
  const src = "https://www.openstreetmap.org/export/embed.html?bbox=-103%2C24%2C-84%2C38&layer=mapnik";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 320,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#0f0f0f",
      }}
    >
      <iframe
        title="Instagram audience location map"
        src={src}
        loading="lazy"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "0",
          pointerEvents: "none",
          filter: "grayscale(0.12) brightness(0.68) contrast(1.02)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(10,10,10,0.10), rgba(10,10,10,0.24))",
        }}
      />
      {mappedCities.map((city) => {
        const radius = 18 + (city.value / maxValue) * 34;

        return (
          <div
            key={city.label}
            title={`${city.label}: ${formatCompactNumber(city.value)}`}
            style={{
              position: "absolute",
              left: city.x,
              top: city.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              style={{
                width: radius,
                height: radius,
                borderRadius: "999px",
                background: "rgba(255,107,53,0.82)",
                border: "2px solid rgba(255,255,255,0.85)",
                boxShadow: "0 0 0 10px rgba(255,107,53,0.14)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function InstagramLocationCard({
  cities,
  countries,
}: {
  cities: BreakdownDatum[];
  countries: BreakdownDatum[];
}) {
  if (cities.length === 0 && countries.length === 0) {
    return null;
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Instagram audience location</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Country and city distribution with a regional map footprint for the current Instagram audience snapshot.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 0.8fr) minmax(220px, 1fr) minmax(320px, 1.15fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <DistributionList title="Country distribution" items={countries} color="#f59e0b" maxItems={8} />
        <DistributionList title="City distribution" items={cities} color="#ff6b35" maxItems={12} />
        <AudienceMapPanel cities={cities.slice(0, 12)} />
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
        <PercentageBarList title="Gender" items={audience.gender} color="#ec4899" />
      </div>
    </div>
  );
}

function InstagramInsights({ detail }: { detail: PlatformDetails }) {
  return (
    <div style={{ display: "grid", gap: 16, marginBottom: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 360px) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <InstagramContentMixCard data={detail.contentMix ?? []} />
        <InstagramLocationCard cities={detail.topCities ?? []} countries={detail.audience?.country ?? []} />
      </div>
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
          yAxisLabel="Followers"
        />
        <TrendCard
          title={detail.performanceLabel}
          note={detail.performanceNote}
          series={detail.performanceTrend}
          color={color}
          driversByDay={detail.activityDrivers}
          valueLabel={detail.performanceLabel}
          yAxisLabel={detail.performanceLabel}
          driverSignalLabel={
            detail.platform === "instagram"
              ? "engagement movement"
              : detail.platform === "facebook"
                ? "post reach"
                : "view delta"
          }
        />
      </div>

      {detail.platform !== "instagram" ? (
        <div style={{ marginBottom: 16 }}>
          <TrendCard
            title={detail.secondaryLabel}
            series={detail.secondaryTrend}
            color={color}
            yAxisLabel={detail.secondaryLabel}
            driversByDay={detail.secondaryActivityDrivers}
            valueLabel={detail.secondaryLabel}
            driverSignalLabel={detail.platform === "facebook" ? "reaction signal" : "like delta"}
          />
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

function DateRangeFilter({ globalDays, onDaysChange, endDate, onEndDateChange }: {
  globalDays: number;
  onDaysChange: (d: number) => void;
  endDate: string;
  onEndDateChange: (d: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const presets = [
    { label: "Last 7d", days: 7 },
    { label: "Last 30d", days: 30 },
    { label: "All Time", days: 365 },
  ];
  const isCustom = !presets.some((p) => p.days === globalDays) || !!endDate;
  const [showCustom, setShowCustom] = useState(isCustom);
  const [customFrom, setCustomFrom] = useState(() => {
    if (isCustom && globalDays < 365) {
      const d = new Date(); d.setDate(d.getDate() - globalDays);
      return d.toISOString().slice(0, 10);
    }
    return "";
  });
  const [customTo, setCustomTo] = useState(endDate || "");

  const applyRange = (from: string, to: string) => {
    if (!from) return;
    const toDate = to || today;
    const fromMs = new Date(from).getTime();
    const toMs = new Date(toDate).getTime();
    const diff = Math.max(1, Math.round((toMs - fromMs) / 86400000));
    onDaysChange(diff);
    onEndDateChange(to && to !== today ? to : "");
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 7,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    background: active ? "rgba(255,255,255,0.08)" : "transparent",
    color: active ? "#fff" : "var(--text-muted)",
    transition: "all 0.15s",
    whiteSpace: "nowrap" as const,
  });

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "#fff",
    fontSize: 12,
    padding: "4px 8px",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, flexWrap: "wrap" }}>
      {presets.map((p) => (
        <button key={p.label} type="button"
          onClick={() => { setShowCustom(false); onDaysChange(p.days); onEndDateChange(""); }}
          style={btnStyle(!showCustom && globalDays === p.days && !endDate)}
        >
          {p.label}
        </button>
      ))}
      <button type="button"
        onClick={() => setShowCustom((v) => !v)}
        style={btnStyle(showCustom)}
      >
        Custom
      </button>
      {showCustom && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 6, flexWrap: "wrap" }}>
          <input
            type="date"
            value={customFrom}
            max={customTo || today}
            onChange={(e) => { setCustomFrom(e.target.value); applyRange(e.target.value, customTo); }}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={today}
            onChange={(e) => { setCustomTo(e.target.value); applyRange(customFrom, e.target.value); }}
            style={inputStyle}
          />
          {(customFrom || customTo) && (
            <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 2 }}>
              {customFrom || "start"} → {customTo || "today"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [globalIncludeZero, setGlobalIncludeZero] = useState(false);
  const [globalMetric, setGlobalMetric] = useState<MetricKey>("reach");
  const [globalDays, setGlobalDays] = useState(30);
  const [globalEndDate, setGlobalEndDate] = useState("");

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
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4 }}>
              {(["followers", "reach", "likes", "comments", "shares"] as MetricKey[]).map((m) => (
                <button key={m} type="button" onClick={() => setGlobalMetric(m)} style={{ padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: globalMetric === m ? "var(--accent)" : "transparent", color: globalMetric === m ? "#fff" : "var(--text-muted)", transition: "all 0.15s" }}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4 }}>
              <button type="button" onClick={() => setGlobalIncludeZero(true)} style={{ padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: globalIncludeZero ? "var(--accent)" : "transparent", color: globalIncludeZero ? "#fff" : "var(--text-muted)", transition: "all 0.15s" }}>Include 0</button>
              <button type="button" onClick={() => setGlobalIncludeZero(false)} style={{ padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: !globalIncludeZero ? "rgba(255,255,255,0.08)" : "transparent", color: !globalIncludeZero ? "#fff" : "var(--text-muted)", transition: "all 0.15s" }}>Zoom</button>
            </div>
            <DateRangeFilter globalDays={globalDays} onDaysChange={setGlobalDays} endDate={globalEndDate} onEndDateChange={setGlobalEndDate} />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {data.summaries.map((summary) => (
              <SummaryTile key={summary.platform} summary={summary} onSelect={setActiveTab} onMetricChange={setGlobalMetric} metric={globalMetric} includeZero={globalIncludeZero} days={globalDays} endDate={globalEndDate} allData={data} />
            ))}
            <CombinedTrendTile data={data.trend} allData={data} includeZero={globalIncludeZero} metric={globalMetric} days={globalDays} endDate={globalEndDate} onMetricChange={setGlobalMetric} />
          </div>
          <PostingCalendarCard data={data} metric={globalMetric} days={globalDays} endDate={globalEndDate} />
          <AllTopPostsCard data={data} days={globalDays} metric={globalMetric} endDate={globalEndDate} />
        </>
      ) : selectedDetail ? (
        <div style={{ display: "grid", gap: 20 }}>
          <PlatformSection detail={selectedDetail} />
        </div>
      ) : null}
    </div>
  );
}
