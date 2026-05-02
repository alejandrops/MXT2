import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════
//  Supabase ADMIN client (S6)
//  ─────────────────────────────────────────────────────────────
//  Cliente con SERVICE_ROLE_KEY · permite operaciones admin como:
//   · auth.admin.updateUserById(id, { password })
//   · auth.admin.createUser({ email, password })
//   · auth.admin.deleteUser(id)
//   · auth.admin.listUsers()
//
//  ⚠️  CRÍTICO · solo usar en server actions / route handlers.
//      Esta key bypasea TODA la auth · si llega al cliente,
//      cualquier usuario podría modificar a cualquier otro.
//
//  Si SUPABASE_SERVICE_ROLE_KEY no está seteada, lanza error.
// ═══════════════════════════════════════════════════════════════

let cachedAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "[supabase/admin] NEXT_PUBLIC_SUPABASE_URL no está seteada.",
    );
  }
  if (!serviceKey) {
    throw new Error(
      "[supabase/admin] SUPABASE_SERVICE_ROLE_KEY no está seteada. " +
        "Para usar admin features, agregá esa variable al .env. " +
        "La encontrás en Supabase Dashboard > Project Settings > API > service_role key.",
    );
  }

  cachedAdmin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedAdmin;
}
