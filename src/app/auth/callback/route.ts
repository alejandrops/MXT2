import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// ═══════════════════════════════════════════════════════════════
//  /auth/callback (H2)
//  ─────────────────────────────────────────────────────────────
//  Maneja redirects de Supabase Auth · password reset, email
//  confirmation, OAuth providers (cuando se agreguen).
//
//  Supabase redirige acá con `?code=...` · intercambiamos el
//  code por una sesión válida en cookies y redirigimos al
//  destino real.
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
