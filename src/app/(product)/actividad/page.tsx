import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /actividad · redirect a primer item del módulo
//  ─────────────────────────────────────────────────────────────
//  Antes redirigía a /actividad/dashboard que no existe → 404.
//  Ahora va a /actividad/reportes (primer item del Sidebar).
// ═══════════════════════════════════════════════════════════════

export default function ActividadIndexPage() {
  redirect("/actividad/reportes");
}
