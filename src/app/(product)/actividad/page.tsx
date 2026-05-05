import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /actividad · redirect a primer item del módulo
//  ─────────────────────────────────────────────────────────────
//  S3-L4.2 · ahora va a /actividad/resumen (era /reportes que
//  quedó como redirect-only). Resumen muestra el bullet table
//  por default cuando se elige modo Visual.
// ═══════════════════════════════════════════════════════════════

export default function ActividadIndexPage() {
  redirect("/actividad/resumen");
}
