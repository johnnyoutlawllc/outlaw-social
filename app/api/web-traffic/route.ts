import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-users";

export const dynamic = "force-dynamic";

const ANALYTICS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANALYTICS_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OUTLAW_DATA_URL = "https://qijclqubjdvqjsgxvkzk.supabase.co";
const OUTLAW_DATA_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpamNscXViamR2cWpzZ3h2a3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDEwNjIsImV4cCI6MjA4NjU3NzA2Mn0.E83M4qkoh7d36NBYAg4N4_1FcYJhAstgZg3zUP2NyM8";

function analyticsClient() {
  return createSupabaseClient(ANALYTICS_URL, ANALYTICS_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
}
function dataClient() {
  return createSupabaseClient(OUTLAW_DATA_URL, OUTLAW_DATA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

type SessionRow = { anonymous_id: string; started_at: string; ended_at: string | null; last_seen_at: string | null; device_type: string | null };
type EventRow = { event_type: string };
type PageVisitRow = { user_email: string; page_name: string; visited_at: string; duration_seconds: number | null; device_type: string | null };

function durationMin(s: SessionRow): number {
  const end = s.ended_at ?? s.last_seen_at;
  if (!end) return 0;
  return Math.max(0, (new Date(end).getTime() - new Date(s.started_at).getTime()) / 60000);
}
function toDay(iso: string) { return iso.slice(0, 10); }

async function fetchSessions(schema: "sf" | "six"): Promise<SessionRow[]> {
  const { data, error } = await analyticsClient().schema(schema).from("analytics_sessions")
    .select("anonymous_id,started_at,ended_at,last_seen_at,device_type");
  if (error) throw new Error(`${schema} sessions: ${error.message}`);
  return (data ?? []) as SessionRow[];
}
async function fetchEvents(schema: "sf" | "six"): Promise<EventRow[]> {
  const { data, error } = await analyticsClient().schema(schema).from("analytics_events").select("event_type");
  if (error) throw new Error(`${schema} events: ${error.message}`);
  return (data ?? []) as EventRow[];
}
async function fetchPageVisits(): Promise<PageVisitRow[]> {
  const { data, error } = await dataClient().schema("outlaw_data").from("page_visits")
    .select("user_email,page_name,visited_at,duration_seconds,device_type");
  if (error) throw new Error(`page_visits: ${error.message}`);
  return (data ?? []) as PageVisitRow[];
}

function buildSiteStats(label: string, url: string, sessions: SessionRow[], events: EventRow[], keyEventDefs: { label: string; types: string[] }[]) {
  const uniqueUsers = new Set(sessions.map((s) => s.anonymous_id)).size;
  const durations = sessions.map(durationMin).filter((d) => d > 0);
  const avgDuration = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0;
  const deviceCounts: Record<string, number> = {};
  for (const s of sessions) { const d = s.device_type ?? "unknown"; deviceCounts[d] = (deviceCounts[d] ?? 0) + 1; }
  const eventCounts: Record<string, number> = {};
  for (const e of events) { eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1; }
  return {
    label, url, totalSessions: sessions.length, uniqueUsers, avgDurationMin: avgDuration,
    keyEvents: keyEventDefs.map(({ label: l, types }) => ({ label: l, count: types.reduce((sum, t) => sum + (eventCounts[t] ?? 0), 0) })),
    deviceBreakdown: Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]).map(([device, count]) => ({ device, count })),
  };
}

function buildDeadWaxStats(visits: PageVisitRow[]) {
  const uniqueUsers = new Set(visits.map((v) => v.user_email)).size;
  const durations = visits.map((v) => (v.duration_seconds ?? 0) / 60).filter((d) => d > 0);
  const avgDuration = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0;
  const pageCounts: Record<string, number> = {};
  for (const v of visits) { const p = v.page_name ?? "Unknown"; pageCounts[p] = (pageCounts[p] ?? 0) + 1; }
  const keyEvents = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  const deviceCounts: Record<string, number> = {};
  for (const v of visits) { const d = v.device_type ?? "unknown"; deviceCounts[d] = (deviceCounts[d] ?? 0) + 1; }
  return {
    label: "Dead Wax Records", url: "https://deadwax.iotaconsult.com",
    totalSessions: visits.length, uniqueUsers, avgDurationMin: avgDuration,
    keyEvents,
    deviceBreakdown: Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]).map(([device, count]) => ({ device, count })),
  };
}

function buildDailyTrend(sfSessions: SessionRow[], sixSessions: SessionRow[], dwVisits: PageVisitRow[]) {
  const sfByDay: Record<string, number> = {};
  const sixByDay: Record<string, number> = {};
  const dwByDay: Record<string, number> = {};
  for (const s of sfSessions)  sfByDay[toDay(s.started_at)]  = (sfByDay[toDay(s.started_at)]  ?? 0) + 1;
  for (const s of sixSessions) sixByDay[toDay(s.started_at)] = (sixByDay[toDay(s.started_at)] ?? 0) + 1;
  for (const v of dwVisits)    dwByDay[toDay(v.visited_at)]  = (dwByDay[toDay(v.visited_at)]  ?? 0) + 1;
  const allDays = Array.from(new Set([...Object.keys(sfByDay), ...Object.keys(sixByDay), ...Object.keys(dwByDay)])).sort();
  return allDays.map((day) => ({ day, sf: sfByDay[day] ?? 0, six: sixByDay[day] ?? 0, dw: dwByDay[day] ?? 0 }));
}

export async function GET() {
  const authClient = await createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user)                       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAllowedEmail(user.email)) return NextResponse.json({ error: "Forbidden"    }, { status: 403 });

  const [sfSessions, sixSessions, sfEvents, sixEvents, dwVisits] = await Promise.all([
    fetchSessions("sf"), fetchSessions("six"), fetchEvents("sf"), fetchEvents("six"), fetchPageVisits(),
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
      buildDeadWaxStats(dwVisits),
    ],
    dailyTrend: buildDailyTrend(sfSessions, sixSessions, dwVisits),
  });
}
