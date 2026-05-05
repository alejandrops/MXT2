"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  /conduccion/infracciones · server actions · S4-L3c
//  ─────────────────────────────────────────────────────────────
//  Mutations sobre Infraction. Por ahora una sola: descartar
//  con razón tipificada.
//
//  Reglas MVP:
//    · Cualquier usuario logueado puede descartar (post-MVP
//      restringido a CA / SA / MA · viene con módulo de roles)
//    · Reabrir queda fuera del MVP · si se descarta por error,
//      hay que tocar BD a mano. Es defensivo: el descarte tiene
//      que ser deliberado.
//    · Audit trail · queda en discardedById, discardedAt,
//      discardReason. La infracción NO se borra.
// ═══════════════════════════════════════════════════════════════

type DiscardReason =
  | "WRONG_SPEED_LIMIT"
  | "WRONG_ROAD_TYPE"
  | "POOR_GPS_QUALITY"
  | "DRIVER_VEHICLE_IMMUNITY";

const VALID_REASONS: DiscardReason[] = [
  "WRONG_SPEED_LIMIT",
  "WRONG_ROAD_TYPE",
  "POOR_GPS_QUALITY",
  "DRIVER_VEHICLE_IMMUNITY",
];

export async function discardInfraction(
  infractionId: string,
  reason: DiscardReason,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validación básica
  if (!infractionId || typeof infractionId !== "string") {
    return { ok: false, error: "ID inválido" };
  }
  if (!VALID_REASONS.includes(reason)) {
    return { ok: false, error: "Razón inválida" };
  }

  // Auth · cualquier usuario logueado en MVP
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "Sesión no encontrada" };
  }

  // Verificar que la infracción existe y está activa
  const existing = await db.infraction.findUnique({
    where: { id: infractionId },
    select: { id: true, status: true, accountId: true },
  });
  if (!existing) {
    return { ok: false, error: "Infracción no encontrada" };
  }
  if (existing.status === "DISCARDED") {
    return { ok: false, error: "La infracción ya estaba descartada" };
  }

  // Multi-tenant · si el usuario tiene un accountId asignado,
  // no puede descartar infracciones de otra cuenta.
  // SA / MA pueden cross-account (accountId null en session).
  const userAccountId = session.user.accountId ?? null;
  if (userAccountId !== null && userAccountId !== existing.accountId) {
    return { ok: false, error: "No autorizado para esta cuenta" };
  }

  // Marcar descartada
  await db.infraction.update({
    where: { id: infractionId },
    data: {
      status: "DISCARDED",
      discardReason: reason,
      discardedById: session.user.id,
      discardedAt: new Date(),
    },
  });

  revalidatePath("/conduccion/infracciones");
  revalidatePath("/conduccion/dashboard");

  return { ok: true };
}
