"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase";

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  async function handleGoogleLogin() {
    setLoading(true);

    const redirectTo = `${window.location.origin}/api/auth/callback`;
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
      ? "That Google account is not on the Outlaw Analytics allowlist."
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
        <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 24 }}>
          Outlaw Social <span style={{ color: "var(--accent)" }}>Analytics</span>
        </h1>

        {errorMessage ? (
          <div
            style={{
              marginBottom: 24,
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
          {loading ? "Sending you to Google..." : "Sign in with Google"}
        </button>
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
