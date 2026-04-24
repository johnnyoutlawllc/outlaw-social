import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createServerSupabaseClient();

  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/login", origin));

  response.cookies.set("user_id", "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}
