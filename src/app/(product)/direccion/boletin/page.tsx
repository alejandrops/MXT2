import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /direccion/boletin
//  ─────────────────────────────────────────────────────────────
//  Entry point del Boletín · redirige siempre al período cerrado
//  más reciente. La URL específica vive en /direccion/boletin/[period].
//
//  Hoy es 28-abr-2026 · el último período mensual completamente
//  cerrado es marzo 2026 · redirige a /direccion/boletin/2026-03.
//
//  Nota · el boletín NO se calcula en tiempo del usuario · se
//  pre-genera al cierre de cada período. En MVP usamos render
//  on-demand pero conceptualmente el dato es del cierre.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default function BoletinIndex() {
  // AR-local · today menos 1 mes · usamos día 1 para evitar
  // saltar meses en transiciones (ej: 31-mar → 28-feb sin marzo)
  const now = new Date();
  // Restamos 3h para AR-local
  const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  // Vamos al día 1 del mes actual, restamos 1 día → último día mes anterior
  const lastClosedDay = new Date(
    Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), 0),
  );
  const period = `${lastClosedDay.getUTCFullYear()}-${String(
    lastClosedDay.getUTCMonth() + 1,
  ).padStart(2, "0")}`;

  redirect(`/direccion/boletin/${period}`);
}
