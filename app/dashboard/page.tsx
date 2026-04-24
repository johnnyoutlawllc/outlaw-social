"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Snapshot {
  snapshot_date: string;
  followers_count: number | null;
  reach: number | null;
  impressions: number | null;
  platform: string;

}

interface Account {
  id: string;
  platform: string;

  platform_username: string;
  avatar_url: string;
  last_synced_at: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  tiktok: "#ff6b35",
};

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: accs } = await supabase.schema("social").from("connected_accounts").select("*").eq("is_active", true);
      setAccounts(accs ?? []);

      const { data: snaps } = await supabase.schema("social").from("account_snapshots")
        .select("snapshot_date, followers_count, reach, impressions, platform, platform_account_id")
        .order("snapshot_date", { ascending: true })
        .limit(60);
      setSnapshots(snaps ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = selected === "all" ? snapshots : snapshots.filter(s => s.platform === selected);

  // Aggregate by date for the chart
  const chartData = Object.values(
    filtered.reduce<Record<string, { date: string; followers: number; reach: number; impressions: number }>>((acc, s) => {
      const d = s.snapshot_date;
      if (!acc[d]) acc[d] = { date: d, followers: 0, reach: 0, impressions: 0 };
      acc[d].followers += s.followers_count ?? 0;
      acc[d].reach += s.reach ?? 0;
      acc[d].impressions += s.impressions ?? 0;
      return acc;
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date));

  const latestFollowers = accounts.reduce((sum, a) => {
    const last = snapshots.filter(s => s.platform === a.platform).slice(-1)[0];
    return sum + (last?.followers_count ?? 0);
  }, 0);

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading metrics…</div>;
  }

  if (accounts.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>No accounts connected yet</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Connect your social accounts to start tracking metrics.</p>
        <a href="/connect"><button className="btn-primary">Connect Accounts</button></a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "facebook", "instagram", "tiktok"].map(p => (
            <button key={p} onClick={() => setSelected(p)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: selected === p ? "var(--accent)" : "transparent", color: selected === p ? "#fff" : "var(--text-muted)", cursor: "pointer", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total Followers", value: latestFollowers.toLocaleString() },
          { label: "Accounts Connected", value: accounts.length },
          { label: "Days Tracked", value: [...new Set(snapshots.map(s => s.snapshot_date))].length },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: 20 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Follower growth chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 20 }}>Follower Growth</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="followers" stroke="var(--accent)" strokeWidth={2} dot={false} name="Followers" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Reach + impressions chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 20 }}>Reach & Impressions</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="reach" stroke="#22c55e" strokeWidth={2} dot={false} name="Reach" />
              <Line type="monotone" dataKey="impressions" stroke="#a855f7" strokeWidth={2} dot={false} name="Impressions" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Account cards */}
      <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Connected Accounts</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {accounts.map(a => {
          const last = snapshots.filter(s => s.platform === a.platform).slice(-1)[0];
          return (
            <div key={a.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: PLATFORM_COLORS[a.platform] ?? "var(--accent)" }} />
                <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{a.platform}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{a.display_name || a.platform_username}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Followers</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{(last?.followers_count ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Reach</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{(last?.reach ?? 0).toLocaleString()}</div>
                </div>
              </div>
              {a.last_synced_at && (
                <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 12 }}>
                  Last synced: {new Date(a.last_synced_at).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
