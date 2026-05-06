"use server";
// @ts-nocheck · pre-existing patterns (Prisma types stale)

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  Alarm workflow · Server Actions · S5-T5
//  ─────────────────────────────────────────────────────────────
//  Transiciones permitidas:
//
//    OPEN      → ATTENDED   (atender)
//    OPEN      → DISMISSED  (descartar)
//    ATTENDED  → CLOSED     (cerrar)
//    ATTENDED  → DISMISSED  (descartar)
//    CLOSED    →            (terminal)
//    DISMISSED →            (terminal)
//
//  Multi-tenant scope · valida que la alarma pertenezca al account
//  del usuario antes de modificarla.
//
//  Cada action revalida /seguridad/alarmas para que el listado
//  refleje el cambio sin reload manual.
// ═══════════════════════════════════════════════════════════════

interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Marca una alarma como atendida · OPEN → ATTENDED.
 * No-op si ya estaba atendida.
 */
export async function attendAlarm(alarmId: string): Promise<ActionResult> {
  const session = await getSession();
  const accountId = resolveAccountScope(session, "seguridad", null);

  const alarm = await db.alarm.findUnique({
    where: { id: alarmId },
    select: { accountId: true, status: true },
  });
  if (!alarm) return { ok: false, error: "Alarma no encontrada" };
  if (accountId !== null && alarm.accountId !== accountId) {
    return { ok: false, error: "Sin permisos sobre esta alarma" };
  }

  if (alarm.status === "ATTENDED") return { ok: true };
  if (alarm.status !== "OPEN") {
    return {
      ok: false,
      error: `No se puede atender una alarma en estado ${alarm.status}`,
    };
  }

  await db.alarm.update({
    where: { id: alarmId },
    data: {
      status: "ATTENDED",
      attendedAt: new Date(),
    },
  });

  revalidatePath("/seguridad/alarmas");
  return { ok: true };
}

/**
 * Cierra una alarma atendida · ATTENDED → CLOSED.
 * Si está OPEN, primero la atiende y después la cierra.
 */
export async function closeAlarm(
  alarmId: string,
  notes?: string,
): Promise<ActionResult> {
  const session = await getSession();
  const accountId = resolveAccountScope(session, "seguridad", null);

  const alarm = await db.alarm.findUnique({
    where: { id: alarmId },
    select: { accountId: true, status: true, attendedAt: true },
  });
  if (!alarm) return { ok: false, error: "Alarma no encontrada" };
  if (accountId !== null && alarm.accountId !== accountId) {
    return { ok: false, error: "Sin permisos sobre esta alarma" };
  }

  if (alarm.status === "CLOSED") return { ok: true };
  if (alarm.status !== "OPEN" && alarm.status !== "ATTENDED") {
    return {
      ok: false,
      error: `No se puede cerrar una alarma en estado ${alarm.status}`,
    };
  }

  const now = new Date();
  await db.alarm.update({
    where: { id: alarmId },
    data: {
      status: "CLOSED",
      closedAt: now,
      // Si nunca fue atendida, marcar atención y cierre simultáneo
      attendedAt: alarm.attendedAt ?? now,
      ...(notes ? { notes } : {}),
    },
  });

  revalidatePath("/seguridad/alarmas");
  return { ok: true };
}

/**
 * Descarta una alarma como falso positivo · OPEN/ATTENDED → DISMISSED.
 */
export async function dismissAlarm(
  alarmId: string,
  notes?: string,
): Promise<ActionResult> {
  const session = await getSession();
  const accountId = resolveAccountScope(session, "seguridad", null);

  const alarm = await db.alarm.findUnique({
    where: { id: alarmId },
    select: { accountId: true, status: true },
  });
  if (!alarm) return { ok: false, error: "Alarma no encontrada" };
  if (accountId !== null && alarm.accountId !== accountId) {
    return { ok: false, error: "Sin permisos sobre esta alarma" };
  }

  if (alarm.status === "DISMISSED") return { ok: true };
  if (alarm.status === "CLOSED") {
    return {
      ok: false,
      error: "No se puede descartar una alarma cerrada · ya está resuelta",
    };
  }

  await db.alarm.update({
    where: { id: alarmId },
    data: {
      status: "DISMISSED",
      closedAt: new Date(),
      ...(notes ? { notes } : {}),
    },
  });

  revalidatePath("/seguridad/alarmas");
  return { ok: true };
}
