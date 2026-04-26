import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-users";

export const dynamic = "force-dynamic";

const ANALYTICS_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANALYTICS_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// outlaw_data project — same one the social dashboard uses
const OUTLAW_DATA_URL = "https://qijclqubjdvqjsgxvkzk.supabase.co";
const OUTLAW_DATA_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpamNscXViamR2cWpzZ3h2a3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDEwNjIsImV4cCI6MjA4NjU3NzA2Mn0.E83M4qkoh7d36NBYAg4N4_1FcYJhAstgZg3zUP2NyM8";

function analyticsClient() {
  return createSupabaseClient(ANALYTICS_URL, ANALYTICS_SVC, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
function dataClient() {
  return createSupabaseClient(OUTLAW_DATA_URL, OUTLAW_DATA_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SessionRow = {
  anonymous_id: string;
  started_at: string;
  ended_at: string | null;
  last_seen_at: string | null;
  device_type: string | null;
};
type EventRow = { event_type: string };
type AccountHistory = { followers_count: number; media_count: number; updated: string };
type InsightRow = { value: number; date: string };
type Payment = { total_money: number; created_at: string; status: string };

function durationMin(s: SessionRow): number {
  const end = s.ended_at ?? s.last_seen_at;
  if (!end) return 0;
  return Math.max(0, (new Date(end).getTime() - new Date(s.started_at).getTime()) / 60000);
}
function toDay(iso: string) { return iso.slice(0, 10); }

async function fetchSessions(schema: "sf" | "six"): Promise<SessionRow[]> {
  const { data, error } = await analyticsClient()
    .schema(schema).from("analytics_sessions")
    .select("anonymous_id,started_at,ended_at,last_seen_at,device_type");
  if (error) throw new Error(`${schema} sessions: ${error.message}`);
  return (data ?? []) as SessionRow[];
}
async function fetchEvents(schema: "sf" | "six"): Promise<EventRow[]> {
  const { data, error } = await analyticsClient()
    .schema(schema).from("analytics_events").select("event_type");
  if (error) throw new Error(`${schema} events: ${error.message}`);
  return (data ?? []) as EventRow[];
}

function buildSiteStats(
  label: string, url: string,
  sessions: SessionRow[], events: EventRow[],
  keyEventDefs: { label: string; types: string[] }[]
) {
  const uniqueUsers = new Set(sessions.map((s) => s.anonymous_id)).size;
  const durations = sessions.map(durationMin).filter((d) => d > 0);
  const avgDuration = durations.length
    ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0;
  const deviceCounts: Record<string, number> = {};
  for (const s of sessions) { const d = s.device_type ?? "unknown"; deviceCounts[d] = (deviceCounts[d] ?? 0) + 1; }
  const eventCounts: Record<string, number> = {};
  for (const e of events) { eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1; }
  return {
    label, url,
    totalSessions: sessions.length, uniqueUsers, avgDurationMin: avgDuration,
    keyEvents: keyEventDefs.map(({ label: l, types }) => ({
      label: l, count: types.reduce((sum, t) => sum + (eventCounts[t] ?? 0), 0),
    })),
    deviceBreakdown: Object.entries(deviceCounts).sort((a, b) => b[1] - a[1])
      .map(([device, count]) => ({ device, count })),
  };
}

function buildDailyTrend(sfSessions: SessionRow[], sixSessions: SessionRow[]) {
  const sfByDay: Record<string, number> = {};
  const sixByDay: Record<string, number> = {};
  for (const s of sfSessions) sfByDay[toDay(s.started_at)] = (sfByDay[toDay(s.started_at)] ?? 0) + 1;
  for (const s of sixSessions) sixByDay[toDay(s.started_at)] = (sixByDay[toDay(s.started_at)] ?? 0) + 1;
  const allDays = Array.from(new Set([...Object.keys(sfByDay), ...Object.keys(sixByDay)])).sort();
  return allDays.map((day) => ({ day, sf: sfByDay[day] ?? 0, six: sixByDay[day] ?? 0 }));
}

async function fetchDeadWaxStats() {
  const db = dataClient();
  const [
    { data: accountHistory, error: e1 },
    { data: recentInsights, error: e2 },
    { data: recentPayments, error: e3 },
  ] = await Promise.all([
    db.schema("outlaw_data").from("instagram_account_history")
      .select("followers_count,media_count,updated")
      .order("updated", { ascending: false }).limit(2),
    db.schema("outlaw_data").from("instagram_insights")
      .select("value,date").eq("metric", "reach")
      .order("date", { ascending: false }).limit(30),
    db.schema("outlaw_data").from("square_payments")
      .select("total_money,created_at,status")
      .order("created_at", { ascending: false }).limit(100),
  ]);

  if (e1 || e2 || e3) {
    console.error("Dead Wax fetch errors:", e1?.message, e2?.message, e3?.message);
  }

  const history = (accountHistory as AccountHistory[] | null) ?? [];
  const latest   = history[0];
  const previous = history[1];
  const followerDelta = latest && previous
    ? latest.followers_count - previous.followers_count : null;

  const insights = (recentInsights as InsightRow[] | null) ?? [];
  const totalReach30d = insights.reduce((s, r) => s + Number(r.value), 0);
  const avgDailyReach = insights.length ? Math.round(totalReach30d / insights.length) : 0;

  const payments = ((recentPayments as Payment[] | null) ?? []).filter(p => p.status === "COMPLETED");
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthRevenue = payments
    .filter(p => p.created_at >= startOfMonth)
    .reduce((s, p) => s + p.total_money, 0);
  const lastSale = payments[0] ?? null;

  // Reach trend ascending for chart
  const reachByDay = [...insights].reverse().map(r => ({ day: r.date, dw: Number(r.value) }));

  return {
    followers: latest?.followers_count ?? 0,
    followerDelta,
    avgDailyReach,
    totalReach30d,
    monthRevenueCents: monthRevenue,
    lastSaleCents: lastSale?.total_money ?? null,
    lastSaleAt: lastSale?.created_at ?? null,
    mediaPosts: latest?.media_count ?? 0,
    reachByDay,
  };
}

export async function GET() {
  const authClient = await createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user)                    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAllowedEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [sfSessions, sixSessions, sfEvents, sixEvents, deadWax] = await Promise.all([
    fetchSessions("sf"), fetchSessions("six"),
    fetchEvents("sf"), fetchEvents("six"),
    fetchDeadWaxStats(),
  ]);

  return NextResponse.json({
    sites: [
      buildSiteStats("Shutterfield", "https://shutterfield.com", sfSessions, sfEvents, [
        { label: "Item Views", types: ["item_view"] },
        { label: "Downloads",  types: ["download", "item_download_variant"] },
        { label: "Edits",      types: ["item_edit"] },
      ]),
      buildSiteStats("SixGuess", "https://sixguess.com", sixSessions, sixEvents, [
        { label: "Guesses",       types: ["guess"] },
        { label: "Games Played",  types: ["game_complete"] },
        { label: "Games Started", types: ["click_play", "view_play"] },
      ]),
    ],
    dailyTrend: buildDailyTrend(sfSessions, sixSessions),
    deadWax,
  });
}
