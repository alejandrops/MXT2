"use server";

// ═══════════════════════════════════════════════════════════════
//  Server actions · Torre de Control
//  ─────────────────────────────────────────────────────────────
//  Mutaciones reales sobre Alarm. Usan revalidatePath para que
//  la cola se refresque después de la acción.
//
//  Q1 confirmado: las acciones persisten (mutan la DB). Cuando
//  haya reseed se vuelve al estado inicial · es esperado.
// ═══════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export interface AttendResult {
  ok: boolean;
  error?: string;
}

/**
 * Marca una alarma como "atendida":
 *   · attendedAt = now
 *   · status sigue OPEN (la alarma no se cierra · pasa al bucket
 *     "en atención" para que se sepa que alguien la está mirando)
 *
 * Idempotente: si ya está atendida, no falla · sólo no mueve la
 * fecha (mantenemos la primera atención como fuente de verdad).
 */
export async function attendAlarm(
  alarmId: string,
): Promise<AttendResult> {
  if (!alarmId || typeof alarmId !== "string") {
    return { ok: false, error: "alarmId inválido" };
  }
  try {
    const existing = await db.alarm.findUnique({
      where: { id: alarmId },
      select: { id: true, status: true, attendedAt: true },
    });
    if (!existing) return { ok: false, error: "Alarma no encontrada" };
    if (existing.status !== "OPEN") {
      return { ok: false, error: "La alarma ya no está abierta" };
    }
    if (existing.attendedAt === null) {
      await db.alarm.update({
        where: { id: alarmId },
        data: { attendedAt: new Date() },
      });
    }
    revalidatePath("/seguimiento/torre-de-control");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Error inesperado" };
  }
}

/**
 * Cierra una alarma:
 *   · status = CLOSED
 *   · closedAt = now
 *   · notes = nota del operador (obligatoria · validada en cliente)
 *
 * Si no estaba atendida, también marca attendedAt = closedAt para
 * mantener el invariante "attendedAt <= closedAt".
 */
export async function closeAlarm(
  alarmId: string,
  notes: string,
): Promise<AttendResult> {
  if (!alarmId || typeof alarmId !== "string") {
    return { ok: false, error: "alarmId inválido" };
  }
  const trimmed = (notes ?? "").trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "La nota es obligatoria (mínimo 3 caracteres)" };
  }
  if (trimmed.length > 1000) {
    return { ok: false, error: "La nota es demasiado larga (máx 1000)" };
  }
  try {
    const existing = await db.alarm.findUnique({
      where: { id: alarmId },
      select: { id: true, status: true, attendedAt: true },
    });
    if (!existing) return { ok: false, error: "Alarma no encontrada" };
    if (existing.status !== "OPEN") {
      return { ok: false, error: "La alarma ya está cerrada" };
    }
    const now = new Date();
    await db.alarm.update({
      where: { id: alarmId },
      data: {
        status: "CLOSED",
        closedAt: now,
        attendedAt: existing.attendedAt ?? now,
        notes: trimmed,
      },
    });
    revalidatePath("/seguimiento/torre-de-control");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Error inesperado" };
  }
}
