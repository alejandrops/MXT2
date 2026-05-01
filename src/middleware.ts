import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ═══════════════════════════════════════════════════════════════
//  middleware.ts (H2)
//  ─────────────────────────────────────────────────────────────
//  Dos responsabilidades:
//
//  1. Refresh de la sesión de Supabase · los access tokens
//     duran ~1 hora. El middleware refresca silenciosamente para
//     que la UX no se interrumpa con timeouts.
//
//  2. Protección de rutas · si AUTH_MODE=supabase y no hay
//     sesión, redirect a /login. Excepciones: /login, /auth/*,
//     /api/ingest/* (que tiene su propia auth con bearer token),
//     y assets estáticos.
//
//  En AUTH_MODE=demo NO se hace nada · el middleware retorna
//  next() inmediatamente.
// ═══════════════════════════════════════════════════════════════

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/signout",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function isPublicPath(pathname: string): boolean {
  // /api/ingest/* tiene su propia auth (X-Flespi-Token)
  if (pathname.startsWith("/api/ingest/")) return true;
  // /api/auth/* (si en el futuro hay endpoints públicos de auth)
  if (pathname.startsWith("/api/auth/")) return true;
  // Páginas de auth UI
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  // En modo demo no hacemos nada
  if (process.env.AUTH_MODE !== "supabase") {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh de la sesión · si falla, user queda logged out
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proteger rutas no-públicas
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si ya está logged in y trata de ir a /login, redirect a home
  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  // Ejecutar el middleware en todas las rutas excepto:
  // · _next/static (assets estáticos)
  // · _next/image (optimización de imágenes)
  // · favicon, archivos públicos
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
