import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ALLOWED_EMAILS = new Set([
  "johnnyoutlawllc@gmail.com",
  "bigsky30media@gmail.com",
]);

function isAllowedEmail(email?: string | null) {
  return !!email && ALLOWED_EMAILS.has(email.toLowerCase());
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/api/auth/callback" ||
    pathname === "/api/auth/signout" ||
    pathname === "/api/auth/facebook/callback" ||
    pathname === "/api/auth/tiktok/callback"
  );
}

function isProtectedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/connect") ||
    pathname === "/api/auth/facebook" ||
    pathname === "/api/auth/tiktok"
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  type CookieOptions = Parameters<typeof response.cookies.set>[2];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname) || !isProtectedPath(pathname)) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAllowedEmail(user.email)) {
    const loginUrl = new URL("/login?error=unauthorized", request.url);
    const redirect = NextResponse.redirect(loginUrl);

    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name === "user_id" || cookie.name.startsWith("sb-")) {
        redirect.cookies.set(cookie.name, "", {
          path: "/",
          maxAge: 0,
        });
      }
    });

    return redirect;
  }

  response.cookies.set("user_id", user.id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
