"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════
//  Server actions · Backoffice Conductores (H7d)
//  ─────────────────────────────────────────────────────────────
//  Permisos · canWrite("backoffice_conductores") · solo SA/MA.
//
//  DELETE es HARD delete:
//   · Antes de borrar el Person, libera los assets que lo tienen
//     como currentDriver (currentDriverId → null).
//   · Borra trips/events/alarms/assetDriverDays asociados al
//     personId.
//
//  Validaciones:
//   · firstName, lastName son required (max 60 chars c/u)
//   · document opcional, max 30 chars · sin unicidad estricta
//     porque distintos clientes pueden tener mismos números
//     (DNI ARG, RUT CL, etc · namespacing por accountId).
//   · safetyScore es DERIVADO del histórico de eventos · no se
//     edita acá. Se muestra read-only en el drawer.
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
}

export interface AdminDriverUpdateInput {
  firstName: string;
  lastName: string;
  document: string;
  /** ISO date string ("YYYY-MM-DD") o "" */
  licenseExpiresAt: string;
  /** ISO date string ("YYYY-MM-DD") o "" */
  hiredAt: string;
  accountId: string;
}

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseIsoDate(s: string): Date | null {
  if (!s || s.trim() === "") return null;
  // Aceptamos "YYYY-MM-DD" del input type="date"
  const d = new Date(s + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function validate(input: AdminDriverUpdateInput): {
  errors: Record<string, string>;
  data?: {
    firstName: string;
    lastName: string;
    document: string | null;
    licenseExpiresAt: Date | null;
    hiredAt: Date | null;
    accountId: string;
  };
} {
  const errors: Record<string, string> = {};
  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const document = trimOrNull(input.document);

  if (firstName.length === 0) errors.firstName = "Requerido";
  else if (firstName.length > 60) errors.firstName = "Máximo 60 caracteres";

  if (lastName.length === 0) errors.lastName = "Requerido";
  else if (lastName.length > 60) errors.lastName = "Máximo 60 caracteres";

  if (document && document.length > 30) {
    errors.document = "Máximo 30 caracteres";
  }

  let licenseExpiresAt: Date | null = null;
  if (input.licenseExpiresAt && input.licenseExpiresAt.trim() !== "") {
    const d = parseIsoDate(input.licenseExpiresAt);
    if (!d) errors.licenseExpiresAt = "Fecha inválida";
    else licenseExpiresAt = d;
  }

  let hiredAt: Date | null = null;
  if (input.hiredAt && input.hiredAt.trim() !== "") {
    const d = parseIsoDate(input.hiredAt);
    if (!d) errors.hiredAt = "Fecha inválida";
    else hiredAt = d;
  }

  if (!input.accountId) errors.accountId = "Cliente requerido";

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    data: {
      firstName,
      lastName,
      document,
      licenseExpiresAt,
      hiredAt,
      accountId: input.accountId,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  Update · campos editables del conductor
// ═══════════════════════════════════════════════════════════════

export async function updateAdminDriver(
  driverId: string,
  input: AdminDriverUpdateInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_conductores")) {
    return { ok: false, message: "No tenés permiso para editar conductores" };
  }

  const existing = await db.person.findUnique({
    where: { id: driverId },
    select: { id: true, accountId: true },
  });
  if (!existing) return { ok: false, message: "Conductor no encontrado" };

  const { errors, data } = validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  const accountExists = await db.account.findUnique({
    where: { id: data.accountId },
    select: { id: true },
  });
  if (!accountExists) {
    return { ok: false, errors: { accountId: "Cliente inválido" } };
  }

  // Si cambia el cliente, hay que liberar los assets que lo tenían
  // como currentDriver, porque seguramente esos assets pertenecen
  // al cliente anterior y ahora no tendría sentido la asignación
  // cross-cliente.
  const accountChanged = data.accountId !== existing.accountId;

  await db.$transaction(async (tx) => {
    if (accountChanged) {
      await tx.asset.updateMany({
        where: { currentDriverId: driverId },
        data: { currentDriverId: null },
      });
    }
    await tx.person.update({
      where: { id: driverId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        document: data.document,
        licenseExpiresAt: data.licenseExpiresAt,
        hiredAt: data.hiredAt,
        accountId: data.accountId,
      },
    });
  });

  revalidatePath("/admin/conductores");
  revalidatePath("/admin/vehiculos");
  revalidatePath("/catalogos/conductores");
  return {
    ok: true,
    message: accountChanged
      ? "Conductor actualizado · vehículos asignados liberados (cliente cambió)"
      : "Conductor actualizado",
  };
}

// ═══════════════════════════════════════════════════════════════
//  Delete · HARD · libera assets, borra trips/events/alarms
// ═══════════════════════════════════════════════════════════════

export async function deleteAdminDriver(
  driverId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_conductores")) {
    return { ok: false, message: "No tenés permiso para eliminar conductores" };
  }

  const existing = await db.person.findUnique({
    where: { id: driverId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!existing) return { ok: false, message: "Conductor no encontrado" };

  await db.$transaction(async (tx) => {
    // 1. Liberar los assets que lo tienen como currentDriver
    await tx.asset.updateMany({
      where: { currentDriverId: driverId },
      data: { currentDriverId: null },
    });
    // 2. Null-ear personId en Trip (NO borrar trips · son del asset)
    await tx.trip.updateMany({
      where: { personId: driverId },
      data: { personId: null },
    });
    // 3. Null-ear personId en Event (NO borrar events · son del asset)
    await tx.event.updateMany({
      where: { personId: driverId },
      data: { personId: null },
    });
    // 4. Null-ear personId en Alarm
    await tx.alarm.updateMany({
      where: { personId: driverId },
      data: { personId: null },
    });
    // 5. Borrar AssetDriverDay (sí son del conductor específicamente)
    await tx.assetDriverDay.deleteMany({ where: { personId: driverId } });
    // 6. Finalmente borrar el Person
    await tx.person.delete({ where: { id: driverId } });
  });

  revalidatePath("/admin/conductores");
  revalidatePath("/admin/vehiculos");
  revalidatePath("/catalogos/conductores");
  return {
    ok: true,
    message: `Conductor "${existing.firstName} ${existing.lastName}" eliminado`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Bulk delete · NO all-or-nothing
// ═══════════════════════════════════════════════════════════════

export async function bulkDeleteAdminDrivers(
  driverIds: string[],
): Promise<{
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_conductores")) {
    return {
      ok: false,
      deleted: 0,
      failed: driverIds.length,
      errors: [],
      message: "No tenés permiso para eliminar conductores",
    };
  }

  if (driverIds.length === 0) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "Seleccioná al menos un conductor.",
    };
  }

  let deleted = 0;
  let failed = 0;
  const errors: { id: string; name: string; message: string }[] = [];

  for (const id of driverIds) {
    const driver = await db.person.findUnique({
      where: { id },
      select: { firstName: true, lastName: true },
    });
    const driverName = driver
      ? `${driver.firstName} ${driver.lastName}`
      : id;

    try {
      const result = await deleteAdminDriver(id);
      if (result.ok) {
        deleted++;
      } else {
        failed++;
        errors.push({
          id,
          name: driverName,
          message: result.message ?? "Error desconocido",
        });
      }
    } catch (err) {
      failed++;
      errors.push({
        id,
        name: driverName,
        message: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }

  revalidatePath("/admin/conductores");
  return {
    ok: deleted > 0,
    deleted,
    failed,
    errors,
    message:
      failed === 0
        ? `${deleted} ${deleted === 1 ? "conductor eliminado" : "conductores eliminados"}`
        : deleted === 0
          ? `Ningún conductor se pudo eliminar`
          : `${deleted} ${deleted === 1 ? "eliminado" : "eliminados"} · ${failed} ${failed === 1 ? "falló" : "fallaron"}`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Delete all matching · "eliminar todo lo filtrado" (H5b)
// ═══════════════════════════════════════════════════════════════

import type { Prisma } from "@prisma/client";

const MS_30D = 30 * 24 * 60 * 60 * 1000;

export interface DeleteAllMatchingDriversFilters {
  search: string | null;
  accountId: string | null;
  assignmentFilter: "with" | "without" | null;
  licenseFilter: "ok" | "expiring_soon" | "expired" | "unknown" | null;
}

export async function deleteAllMatchingDrivers(
  filters: DeleteAllMatchingDriversFilters,
): Promise<{
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_conductores")) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "No tenés permiso para eliminar conductores",
    };
  }

  const now = new Date();
  const soon = new Date(now.getTime() + MS_30D);

  const where: Prisma.PersonWhereInput = {};
  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search } },
      { lastName: { contains: filters.search } },
      { document: { contains: filters.search } },
    ];
  }
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.assignmentFilter === "with") {
    where.drivenAssets = { some: {} };
  } else if (filters.assignmentFilter === "without") {
    where.drivenAssets = { none: {} };
  }
  if (filters.licenseFilter === "expired") {
    where.licenseExpiresAt = { lt: now };
  } else if (filters.licenseFilter === "expiring_soon") {
    where.licenseExpiresAt = { gte: now, lte: soon };
  } else if (filters.licenseFilter === "ok") {
    where.licenseExpiresAt = { gt: soon };
  } else if (filters.licenseFilter === "unknown") {
    where.licenseExpiresAt = null;
  }

  const matching = await db.person.findMany({
    where,
    select: { id: true, firstName: true, lastName: true },
  });

  if (matching.length === 0) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "No hay conductores que coincidan con los filtros.",
    };
  }

  let deleted = 0;
  let failed = 0;
  const errors: { id: string; name: string; message: string }[] = [];

  for (const p of matching) {
    const fullName = `${p.firstName} ${p.lastName}`;
    try {
      const result = await deleteAdminDriver(p.id);
      if (result.ok) {
        deleted++;
      } else {
        failed++;
        errors.push({
          id: p.id,
          name: fullName,
          message: result.message ?? "Error desconocido",
        });
      }
    } catch (err) {
      failed++;
      errors.push({
        id: p.id,
        name: fullName,
        message: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }

  revalidatePath("/admin/conductores");
  return {
    ok: deleted > 0,
    deleted,
    failed,
    errors,
    message:
      failed === 0
        ? `${deleted} ${deleted === 1 ? "conductor eliminado" : "conductores eliminados"}`
        : deleted === 0
          ? `Ningún conductor se pudo eliminar`
          : `${deleted} ${deleted === 1 ? "eliminado" : "eliminados"} · ${failed} ${failed === 1 ? "falló" : "fallaron"}`,
  };
}
