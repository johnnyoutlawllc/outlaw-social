import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-users";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  const safeNext = next.startsWith("/") ? next : "/";
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();

    const response = NextResponse.redirect(new URL("/login?error=unauthorized", origin));

    response.cookies.set("user_id", "", {
      path: "/",
      maxAge: 0,
    });

    return response;
  }

  const response = NextResponse.redirect(new URL(safeNext, origin));

  response.cookies.set("user_id", user.id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
