import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Outlaw Social Analytics",
  description: "Private social analytics workspace for Johnny Outlaw brands",
  icons: {
    icon: [
      { url: '/johnny-outlaw-icon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: { url: '/johnny-outlaw-icon-192.png', sizes: '192x192', type: 'image/png' },
  },
};

const VERSION = "v42102";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav style={{ borderBottom: "1px solid var(--border)", padding: "0 24px", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/" style={{ textDecoration: "none", letterSpacing: "-0.02em" }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>Outlaw Social Analytics</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginTop: 1 }}>{VERSION}</span>
          </Link>
          <a href="https://outlawapps.online" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 14 }}>
            Back to Outlaw Apps
          </a>
        </nav>
        <main style={{ minHeight: "calc(100vh - 72px)" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
