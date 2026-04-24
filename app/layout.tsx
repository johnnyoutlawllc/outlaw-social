import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Outlaw Social",
  description: "Social media metrics dashboard for Facebook, Instagram, and TikTok",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav style={{ borderBottom: "1px solid var(--border)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>Outlaw Social</span>
          <div style={{ display: "flex", gap: 24 }}>
            <a href="/dashboard" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 14 }}>Dashboard</a>
            <a href="/connect" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 14 }}>Connect</a>
            <a href="/accounts" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 14 }}>Accounts</a>
          </div>
        </nav>
        <main style={{ minHeight: "calc(100vh - 56px)" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
