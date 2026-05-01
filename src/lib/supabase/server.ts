import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ═══════════════════════════════════════════════════════════════
//  Supabase server client (H2)
//  ─────────────────────────────────────────────────────────────
//  Para Server Components, Route Handlers y Server Actions.
//
//  IMPORTANTE: usar uno por request · NO instanciar al top-level.
//  El SSR helper de Supabase usa las cookies del request actual
//  para mantener la sesión consistente entre llamadas.
//
//  Uso típico:
//
//    const supabase = await createServerSupabase();
//    const { data: { user } } = await supabase.auth.getUser();
// ═══════════════════════════════════════════════════════════════

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Llamado desde un Server Component (no Route Handler)
            // · no podemos setear cookies desde acá · es OK porque
            // el middleware se encarga de mantener la sesión fresca.
          }
        },
      },
    },
  );
}
