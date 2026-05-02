import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /direccion/boletin
//  ─────────────────────────────────────────────────────────────
//  Entry point del Boletín · redirige siempre al período cerrado
//  más reciente. La URL específica vive en /direccion/boletin/[period].
//
//  Hoy es mayo 2026 · el último período mensual completamente
//  cerrado es abril 2026 · redirige a /direccion/boletin/2026-04.
//
//  Nota · el boletín NO se calcula en tiempo del usuario · se
//  pre-genera al cierre de cada período. En MVP usamos render
//  on-demand pero conceptualmente el dato es del cierre.
//
//  L1 · refactor para evitar la pantalla blanca reportada en feedback.
//  Extraemos el cálculo a una función pura · más fácil de testear y
//  de mover a un helper compartido cuando otras pantallas necesiten
//  "último período cerrado".
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

function getLastClosedPeriod(): string {
  const now = new Date();
  // Restamos 3h para AR-local
  const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  // Vamos al día 1 del mes actual, restamos 1 día → último día mes anterior
  const lastClosedDay = new Date(
    Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), 0),
  );
  return `${lastClosedDay.getUTCFullYear()}-${String(
    lastClosedDay.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

export default function BoletinIndex() {
  const period = getLastClosedPeriod();
  redirect(`/direccion/boletin/${period}`);
}
