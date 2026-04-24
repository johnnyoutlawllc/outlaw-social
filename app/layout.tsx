import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Outlaw Social Analytics",
  description: "Private social analytics workspace for Johnny Outlaw brands",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav style={{ borderBottom: "1px solid var(--border)", padding: "0 24px", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)", textDecoration: "none", letterSpacing: "-0.02em" }}>
            Outlaw Social Analytics
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
