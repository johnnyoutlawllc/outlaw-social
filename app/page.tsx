import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-users";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    redirect("/login");
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px 96px" }}>
      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18 }}>
          Private Workspace
        </div>
        <h1 style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05, marginBottom: 14 }}>
          Welcome to Outlaw Social <span style={{ color: "var(--accent)" }}>Analytics</span>
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 18, lineHeight: 1.6, marginBottom: 28 }}>
          You&apos;re in. This is the secure front door for the Supabase-backed social dashboard, and we can build the real analytics view from here.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div className="pill">Signed in as {user.email}</div>
          <div className="pill">Google protected</div>
          <div className="pill">Supabase data ready</div>
        </div>
      </div>

      <div className="card" style={{ padding: 28, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Next up</h2>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
            We can wire in account summaries, trend charts, and post-level reporting next without reopening auth.
          </p>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="btn-ghost" type="submit" style={{ minWidth: 140 }}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
