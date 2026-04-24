"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const platforms = [
  {
    id: "facebook",
    name: "Facebook",
    description: "Page followers, reach, impressions, post engagement",
    href: "/api/auth/facebook",
    color: "#1877F2",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Followers, reach, impressions, media insights — connected automatically via Facebook",
    href: "/api/auth/facebook",
    color: "#E1306C",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="url(#ig-grad)">
        <defs>
          <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f09433"/>
            <stop offset="25%" stopColor="#e6683c"/>
            <stop offset="50%" stopColor="#dc2743"/>
            <stop offset="75%" stopColor="#cc2366"/>
            <stop offset="100%" stopColor="#bc1888"/>
          </linearGradient>
        </defs>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Followers, video views, likes, comments, shares",
    href: "/api/auth/tiktok",
    color: "#010101",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.01-.04z"/>
      </svg>
    ),
  },
];

function ConnectContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  return (
    <div style={{ maxWidth: 680, margin: "60px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Connect Accounts</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 40 }}>
        Authenticate each platform to start ingesting your metrics twice daily.
      </p>

      {success && (
        <div style={{ background: "#052e16", border: "1px solid #16a34a", borderRadius: 8, padding: "12px 16px", marginBottom: 24, color: "#22c55e" }}>
          ✓ {success === "meta" ? "Facebook + Instagram" : "TikTok"} connected successfully.
        </div>
      )}
      {error && (
        <div style={{ background: "#2d0a0a", border: "1px solid var(--error)", borderRadius: 8, padding: "12px 16px", marginBottom: 24, color: "var(--error)" }}>
          Connection failed: {error.replace(/_/g, " ")}. Try again.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {platforms.map((p) => (
          <div key={p.id} className="card" style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: p.id === "tiktok" ? "#010101" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
                {p.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 380 }}>{p.description}</div>
              </div>
            </div>
            <a href={p.href}>
              <button className="btn-primary" style={{ whiteSpace: "nowrap" }}>Connect</button>
            </a>
          </div>
        ))}
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 32 }}>
        Instagram connects automatically through Facebook — no separate flow needed.
        Ingestion runs at 8 AM and 8 PM UTC daily.
      </p>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectContent />
    </Suspense>
  );
}
