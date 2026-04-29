"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite, getScopedAccountIds } from "@/lib/permissions";
import { getPersonRelationCounts } from "@/lib/queries/persons";

// ═══════════════════════════════════════════════════════════════
//  Server actions · CRUD Person (Conductores)
//  ─────────────────────────────────────────────────────────────
//  Soft delete · Person no tiene campo `archivedAt` ni `status`
//  en MVP. Por ahora hacemos HARD delete con verificación previa
//  de relaciones · si tiene drivenAssets/events/alarms/trips/
//  assetDriverDays, la action devuelve error pidiendo reasignar
//  primero.
//
//  Cuando agreguemos `archivedAt` (post-MVP) reemplazamos delete
//  por update + filtro en queries.
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
}

export interface PersonInput {
  /** Solo create · ignorado en update */
  accountId?: string;
  firstName: string;
  lastName: string;
  document: string;
  hiredAt: string;
  licenseExpiresAt: string;
}

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseDateOrNull(v: string | null | undefined): Date | null {
  const t = (v ?? "").trim();
  if (t.length === 0) return null;
  // Formato esperado del input type="date" · YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!match) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface ValidatedData {
  firstName: string;
  lastName: string;
  document: string | null;
  hiredAt: Date | null;
  licenseExpiresAt: Date | null;
}

function validate(input: PersonInput, forCreate: boolean): {
  errors: Record<string, string>;
  data?: ValidatedData;
} {
  const errors: Record<string, string> = {};

  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const document = trimOrNull(input.document);

  if (firstName.length === 0) errors.firstName = "Requerido";
  else if (firstName.length > 50) errors.firstName = "Máximo 50 caracteres";

  if (lastName.length === 0) errors.lastName = "Requerido";
  else if (lastName.length > 50) errors.lastName = "Máximo 50 caracteres";

  if (document && document.length > 30)
    errors.document = "Máximo 30 caracteres";

  // Fechas · si vienen, deben parsear; si vacías, null
  const hiredAtRaw = (input.hiredAt ?? "").trim();
  let hiredAt: Date | null = null;
  if (hiredAtRaw.length > 0) {
    hiredAt = parseDateOrNull(hiredAtRaw);
    if (!hiredAt) errors.hiredAt = "Fecha inválida";
  }

  const licenseRaw = (input.licenseExpiresAt ?? "").trim();
  let licenseExpiresAt: Date | null = null;
  if (licenseRaw.length > 0) {
    licenseExpiresAt = parseDateOrNull(licenseRaw);
    if (!licenseExpiresAt) errors.licenseExpiresAt = "Fecha inválida";
  }

  if (forCreate && !input.accountId) {
    errors.accountId = "Cliente requerido";
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    data: { firstName, lastName, document, hiredAt, licenseExpiresAt },
  };
}

// ═══════════════════════════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════════════════════════

export async function createPerson(input: PersonInput): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "catalogos")) {
    return { ok: false, message: "No tenés permiso para crear conductores." };
  }

  // Si scoped, forzar accountId
  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped)) {
    if (scoped.length === 0) return { ok: false, message: "Sin permiso." };
    if (!input.accountId || !scoped.includes(input.accountId)) {
      input.accountId = scoped[0];
    }
  }

  const { errors, data } = validate(input, true);
  if (Object.keys(errors).length > 0 || !data) {
    return { ok: false, errors };
  }

  // Validar accountId existe
  const account = await db.account.findUnique({
    where: { id: input.accountId! },
    select: { id: true },
  });
  if (!account) {
    return { ok: false, errors: { accountId: "Cliente inválido" } };
  }

  const created = await db.person.create({
    data: {
      accountId: input.accountId!,
      firstName: data.firstName,
      lastName: data.lastName,
      document: data.document,
      hiredAt: data.hiredAt,
      licenseExpiresAt: data.licenseExpiresAt,
      // safetyScore default 75 (del schema) · derivado de eventos
      // en producción · seed-time en demo
    },
  });

  revalidatePath("/catalogos/conductores");
  return { ok: true, message: "Conductor creado", id: created.id };
}

// ═══════════════════════════════════════════════════════════════
//  Update
// ═══════════════════════════════════════════════════════════════

export async function updatePerson(
  personId: string,
  input: PersonInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "catalogos")) {
    return { ok: false, message: "No tenés permiso para editar conductores." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }

  const existing = await db.person.findUnique({
    where: { id: personId },
    select: { id: true, accountId: true },
  });
  if (!existing) return { ok: false, message: "Conductor no encontrado" };
  if (Array.isArray(scoped) && !scoped.includes(existing.accountId)) {
    return { ok: false, message: "Sin permiso para este conductor." };
  }

  // accountId no se cambia en update
  input.accountId = existing.accountId;

  const { errors, data } = validate(input, false);
  if (Object.keys(errors).length > 0 || !data) {
    return { ok: false, errors };
  }

  await db.person.update({
    where: { id: personId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      document: data.document,
      hiredAt: data.hiredAt,
      licenseExpiresAt: data.licenseExpiresAt,
    },
  });

  revalidatePath("/catalogos/conductores");
  return { ok: true, message: "Conductor actualizado" };
}

// ═══════════════════════════════════════════════════════════════
//  Hard delete · solo si no tiene relaciones
//  ─────────────────────────────────────────────────────────────
//  Como Person no tiene `archivedAt` en el schema todavía, hacemos
//  hard delete pero verificamos antes que no haya FKs apuntando.
//  Si tiene · devolver error explicativo.
// ═══════════════════════════════════════════════════════════════

export async function deletePerson(personId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "catalogos")) {
    return { ok: false, message: "No tenés permiso." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }

  const existing = await db.person.findUnique({
    where: { id: personId },
    select: { accountId: true, firstName: true, lastName: true },
  });
  if (!existing) return { ok: false, message: "Conductor no encontrado" };
  if (Array.isArray(scoped) && !scoped.includes(existing.accountId)) {
    return { ok: false, message: "Sin permiso para este conductor." };
  }

  // Verificar relaciones
  const counts = await getPersonRelationCounts(personId);
  if (counts.total > 0) {
    const parts: string[] = [];
    if (counts.drivenAssets > 0)
      parts.push(`${counts.drivenAssets} ${counts.drivenAssets === 1 ? "vehículo asignado" : "vehículos asignados"}`);
    if (counts.trips > 0)
      parts.push(`${counts.trips} ${counts.trips === 1 ? "viaje" : "viajes"}`);
    if (counts.events > 0)
      parts.push(`${counts.events} ${counts.events === 1 ? "evento" : "eventos"}`);
    if (counts.alarms > 0)
      parts.push(`${counts.alarms} ${counts.alarms === 1 ? "alarma" : "alarmas"}`);
    if (counts.assetDriverDays > 0)
      parts.push(`${counts.assetDriverDays} ${counts.assetDriverDays === 1 ? "día de actividad" : "días de actividad"}`);

    return {
      ok: false,
      message: `No se puede eliminar a ${existing.firstName} ${existing.lastName} · tiene ${parts.join(", ")}. Reasigná o limpiá esas relaciones primero.`,
    };
  }

  await db.person.delete({ where: { id: personId } });
  revalidatePath("/catalogos/conductores");
  return { ok: true, message: "Conductor eliminado" };
}
