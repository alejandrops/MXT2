"use client";

import { createBrowserClient } from "@supabase/ssr";

// ═══════════════════════════════════════════════════════════════
//  Supabase browser client (H2)
//  ─────────────────────────────────────────────────────────────
//  Para Client Components que necesiten interactuar con
//  Supabase Auth (login form, signOut button, etc.).
//
//  Singleton dentro del browser context · createBrowserClient
//  es seguro de llamar múltiples veces, devuelve la misma
//  instancia.
// ═══════════════════════════════════════════════════════════════

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
