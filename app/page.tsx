import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ maxWidth: 680, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 16 }}>
        Outlaw <span style={{ color: "var(--accent)" }}>Social</span>
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 18, marginBottom: 48 }}>
        Track your Facebook, Instagram, and TikTok metrics in one place.
        Twice-daily ingestion. Zero fluff.
      </p>
      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        <Link href="/connect">
          <button className="btn-primary" style={{ fontSize: 16, padding: "14px 32px" }}>Connect Accounts</button>
        </Link>
        <Link href="/dashboard">
          <button className="btn-ghost" style={{ fontSize: 16, padding: "14px 32px" }}>View Dashboard</button>
        </Link>
      </div>
    </div>
  );
}
