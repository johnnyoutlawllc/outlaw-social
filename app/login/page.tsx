"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase";

function LoginContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");

  async function handleGoogleLogin() {
    setLoading(true);

    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
    const supabase = getBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (signInError) {
      setLoading(false);
    }
  }

  const errorMessage =
    error === "unauthorized"
      ? "That Google account is not on the Outlaw Social Analytics allowlist."
      : error === "auth_failed"
        ? "Google sign-in failed. Give it another shot."
        : null;

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 520, padding: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span
            style={{
              display: "inline-flex",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 22px rgba(255, 107, 53, 0.4)",
            }}
          />
          <span style={{ color: "var(--text-muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Private Access
          </span>
        </div>

        <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 12 }}>
          Outlaw Social <span style={{ color: "var(--accent)" }}>Analytics</span>
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
          Sign in with Google to reach the private analytics workspace. Right now only Johnny&apos;s approved accounts can get in.
        </p>

        {errorMessage ? (
          <div
            style={{
              marginBottom: 20,
              borderRadius: 10,
              border: "1px solid rgba(239, 68, 68, 0.5)",
              background: "rgba(127, 29, 29, 0.35)",
              color: "#fca5a5",
              padding: "12px 14px",
              fontSize: 14,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <button
          type="button"
          className="btn-primary"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ width: "100%", padding: "14px 18px", fontSize: 15 }}
        >
          {loading ? "Sending you to Google..." : "Continue with Google"}
        </button>

        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 18 }}>
          Allowed users: johnnyoutlawllc@gmail.com and bigsky30media@gmail.com
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
