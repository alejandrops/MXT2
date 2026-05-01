import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// ═══════════════════════════════════════════════════════════════
//  /auth/signout (H2)
//  ─────────────────────────────────────────────────────────────
//  POST endpoint · cierra la sesión de Supabase y redirige.
//  Accept POST para evitar CSRF accidental con un GET preview.
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
