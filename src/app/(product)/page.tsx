import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  Home route
//  ─────────────────────────────────────────────────────────────
//  Lote 1: Redirects to the Seguridad dashboard (the primary
//  demo surface). In a later lote this becomes a real landing
//  page with an account switcher and cross-module snapshot.
// ═══════════════════════════════════════════════════════════════

export default function HomePage() {
  redirect("/seguridad/dashboard");
}
