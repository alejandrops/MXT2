// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════
//  Server actions · CRUD Device (H2)
//  ─────────────────────────────────────────────────────────────
//  Solo SA y MA tienen permiso (canWrite("backoffice_dispositivos"))
//
//  Reglas de status:
//   - STOCK         · assetId DEBE ser null
//   - INSTALLED     · assetId requerido
//   - IN_REPAIR     · assetId puede ser null o el último (preserva
//                     historial pero el device no opera)
//   - DECOMMISSIONED· assetId DEBE ser null
//
//  isPrimary:
//   - Solo aplica cuando status = INSTALLED y assetId no es null
//   - Si marcás isPrimary=true, des-marcamos el primary anterior
//     del mismo asset (un solo primary por asset)
//
//  IMEI:
//   - Único · validamos antes de crear/actualizar
//   - 15 dígitos numéricos
//
//  DELETE:
//   - Hard delete · pero solo si status NO es INSTALLED
//   - Si está instalado, hay que primero desinstalarlo (cambiar
//     status a IN_REPAIR o DECOMMISSIONED)
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
}

export interface DeviceInput {
  imei: string;
  serialNumber: string;
  vendor: "TELTONIKA" | "QUECLINK" | "CONCOX" | "OTHER";
  model: string;
  firmwareVersion: string;
  status: "STOCK" | "INSTALLED" | "IN_REPAIR" | "DECOMMISSIONED";
  assetId: string | null;
  isPrimary: boolean;
}

const VALID_VENDORS = ["TELTONIKA", "QUECLINK", "CONCOX", "OTHER"] as const;
const VALID_STATUSES = [
  "STOCK",
  "INSTALLED",
  "IN_REPAIR",
  "DECOMMISSIONED",
] as const;

const IMEI_RE = /^\d{15}$/;

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

interface ValidatedData {
  imei: string;
  serialNumber: string | null;
  vendor: "TELTONIKA" | "QUECLINK" | "CONCOX" | "OTHER";
  model: string;
  firmwareVersion: string | null;
  status: "STOCK" | "INSTALLED" | "IN_REPAIR" | "DECOMMISSIONED";
  assetId: string | null;
  isPrimary: boolean;
}

async function validate(input: DeviceInput): Promise<{
  errors: Record<string, string>;
  data?: ValidatedData;
}> {
  const errors: Record<string, string> = {};
  const imei = (input.imei ?? "").trim();
  const serialNumber = trimOrNull(input.serialNumber);
  const model = (input.model ?? "").trim();
  const firmwareVersion = trimOrNull(input.firmwareVersion);

  if (imei.length === 0) errors.imei = "Requerido";
  else if (!IMEI_RE.test(imei)) errors.imei = "IMEI debe tener exactamente 15 dígitos numéricos";

  if (model.length === 0) errors.model = "Requerido";
  else if (model.length > 60) errors.model = "Máximo 60 caracteres";

  if (!VALID_VENDORS.includes(input.vendor)) errors.vendor = "Vendor inválido";
  if (!VALID_STATUSES.includes(input.status)) errors.status = "Estado inválido";

  // Validación cruzada · assetId vs status
  if (input.status === "INSTALLED" && !input.assetId) {
    errors.assetId = "Un dispositivo instalado debe tener un vehículo asignado";
  }
  if (input.status === "STOCK" && input.assetId) {
    errors.assetId = "Un dispositivo en stock no puede estar asignado a un vehículo";
  }
  if (input.status === "DECOMMISSIONED" && input.assetId) {
    errors.assetId = "Un dispositivo dado de baja no puede estar asignado a un vehículo";
  }

  // isPrimary solo si está INSTALLED
  if (input.isPrimary && input.status !== "INSTALLED") {
    errors.isPrimary = "Solo dispositivos instalados pueden ser principales";
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    data: {
      imei,
      serialNumber,
      vendor: input.vendor,
      model,
      firmwareVersion,
      status: input.status,
      assetId: input.assetId,
      isPrimary: input.isPrimary && input.status === "INSTALLED",
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════════════════════════

export async function createDevice(input: DeviceInput): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_dispositivos")) {
    return { ok: false, message: "No tenés permiso para crear dispositivos" };
  }

  const { errors, data } = await validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // IMEI único
  const dup = await db.device.findUnique({
    where: { imei: data.imei },
    select: { id: true },
  });
  if (dup) {
    return { ok: false, errors: { imei: "Ya existe un dispositivo con ese IMEI" } };
  }

  // Validar assetId existe (si aplica)
  if (data.assetId) {
    const asset = await db.asset.findUnique({
      where: { id: data.assetId },
      select: { id: true },
    });
    if (!asset) return { ok: false, errors: { assetId: "Vehículo inválido" } };
  }

  await db.$transaction(async (tx) => {
    // Si va a ser primary, des-marcar el primary actual del mismo asset
    if (data.isPrimary && data.assetId) {
      await tx.device.updateMany({
        where: { assetId: data.assetId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    await tx.device.create({
      data: {
        imei: data.imei,
        serialNumber: data.serialNumber,
        vendor: data.vendor,
        model: data.model,
        firmwareVersion: data.firmwareVersion,
        status: data.status,
        assetId: data.assetId,
        isPrimary: data.isPrimary,
      },
    });
  });

  revalidatePath("/admin/dispositivos");
  return { ok: true, message: "Dispositivo creado" };
}

// ═══════════════════════════════════════════════════════════════
//  Update
// ═══════════════════════════════════════════════════════════════

export async function updateDevice(
  deviceId: string,
  input: DeviceInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_dispositivos")) {
    return { ok: false, message: "No tenés permiso para editar dispositivos" };
  }

  const existing = await db.device.findUnique({
    where: { id: deviceId },
    select: { id: true, imei: true },
  });
  if (!existing) return { ok: false, message: "Dispositivo no encontrado" };

  const { errors, data } = await validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // IMEI único (excluyendo el propio)
  if (data.imei !== existing.imei) {
    const conflict = await db.device.findUnique({
      where: { imei: data.imei },
      select: { id: true },
    });
    if (conflict) {
      return {
        ok: false,
        errors: { imei: "Ya existe otro dispositivo con ese IMEI" },
      };
    }
  }

  // Validar assetId existe (si aplica)
  if (data.assetId) {
    const asset = await db.asset.findUnique({
      where: { id: data.assetId },
      select: { id: true },
    });
    if (!asset) return { ok: false, errors: { assetId: "Vehículo inválido" } };
  }

  await db.$transaction(async (tx) => {
    if (data.isPrimary && data.assetId) {
      await tx.device.updateMany({
        where: {
          assetId: data.assetId,
          isPrimary: true,
          NOT: { id: deviceId },
        },
        data: { isPrimary: false },
      });
    }

    await tx.device.update({
      where: { id: deviceId },
      data: {
        imei: data.imei,
        serialNumber: data.serialNumber,
        vendor: data.vendor,
        model: data.model,
        firmwareVersion: data.firmwareVersion,
        status: data.status,
        assetId: data.assetId,
        isPrimary: data.isPrimary,
      },
    });
  });

  revalidatePath("/admin/dispositivos");
  return { ok: true, message: "Dispositivo actualizado" };
}

// ═══════════════════════════════════════════════════════════════
//  Delete · hard, bloqueado si está INSTALLED
// ═══════════════════════════════════════════════════════════════

export async function deleteDevice(deviceId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_dispositivos")) {
    return { ok: false, message: "No tenés permiso para eliminar dispositivos" };
  }

  const existing = await db.device.findUnique({
    where: { id: deviceId },
    select: { id: true, imei: true, status: true },
  });
  if (!existing) return { ok: false, message: "Dispositivo no encontrado" };

  if (existing.status === "INSTALLED") {
    return {
      ok: false,
      message: `No se puede eliminar un dispositivo instalado. Cambiá el estado a "En reparación" o "Dado de baja" antes de eliminarlo.`,
    };
  }

  await db.device.delete({ where: { id: deviceId } });

  revalidatePath("/admin/dispositivos");
  return { ok: true, message: `Dispositivo ${existing.imei} eliminado` };
}

// ═══════════════════════════════════════════════════════════════
//  Bulk delete + Delete all matching · H5b
// ═══════════════════════════════════════════════════════════════

import type { Prisma } from "@prisma/client";

export async function bulkDeleteAdminDevices(
  deviceIds: string[],
): Promise<{
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_dispositivos")) {
    return {
      ok: false,
      deleted: 0,
      failed: deviceIds.length,
      errors: [],
      message: "No tenés permiso para eliminar dispositivos",
    };
  }

  if (deviceIds.length === 0) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "Seleccioná al menos un dispositivo.",
    };
  }

  let deleted = 0;
  let failed = 0;
  const errors: { id: string; name: string; message: string }[] = [];

  for (const id of deviceIds) {
    const d = await db.device.findUnique({
      where: { id },
      select: { imei: true },
    });
    const name = d?.imei ?? id;
    try {
      const result = await deleteDevice(id);
      if (result.ok) {
        deleted++;
      } else {
        failed++;
        errors.push({
          id,
          name,
          message: result.message ?? "Error desconocido",
        });
      }
    } catch (err) {
      failed++;
      errors.push({
        id,
        name,
        message: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }

  revalidatePath("/admin/dispositivos");
  return {
    ok: deleted > 0,
    deleted,
    failed,
    errors,
    message:
      failed === 0
        ? `${deleted} ${deleted === 1 ? "dispositivo eliminado" : "dispositivos eliminados"}`
        : deleted === 0
          ? `Ningún dispositivo se pudo eliminar`
          : `${deleted} ${deleted === 1 ? "eliminado" : "eliminados"} · ${failed} ${failed === 1 ? "falló" : "fallaron"}`,
  };
}

export interface DeleteAllMatchingDevicesFilters {
  search: string | null;
  state: string | null;
  status: string | null;
  vendor: string | null;
  primaryOnly: boolean;
}

export async function deleteAllMatchingDevices(
  filters: DeleteAllMatchingDevicesFilters,
): Promise<{
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_dispositivos")) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "No tenés permiso para eliminar dispositivos",
    };
  }

  // Construir where similar a listDevices
  const where: Prisma.DeviceWhereInput = {};
  if (filters.search) {
    where.OR = [
      { imei: { contains: filters.search } },
      { serialNumber: { contains: filters.search } },
      { model: { contains: filters.search } },
    ];
  }
  if (filters.status) where.status = filters.status as any;
  if (filters.vendor) where.vendor = filters.vendor as any;
  if (filters.primaryOnly) where.isPrimary = true;

  // El filtro de comm state (ONLINE/RECENT/STALE/LONG/OFFLINE) es derivado
  // de lastSeenAt. No lo aplicamos acá · si filtraron por state, hay que
  // hacer el cálculo. Lo dejamos como filtro adicional cliente-side, por
  // ahora si state está activo, agregamos el rango de lastSeenAt.
  if (filters.state) {
    const now = Date.now();
    const M = 60 * 1000;
    const H = 60 * M;
    if (filters.state === "ONLINE") {
      where.lastSeenAt = { gte: new Date(now - 5 * M) };
    } else if (filters.state === "RECENT") {
      where.lastSeenAt = {
        gte: new Date(now - H),
        lt: new Date(now - 5 * M),
      };
    } else if (filters.state === "STALE") {
      where.lastSeenAt = {
        gte: new Date(now - 24 * H),
        lt: new Date(now - H),
      };
    } else if (filters.state === "LONG") {
      where.lastSeenAt = {
        gte: new Date(now - 7 * 24 * H),
        lt: new Date(now - 24 * H),
      };
    } else if (filters.state === "OFFLINE") {
      where.OR = [
        { lastSeenAt: null },
        { lastSeenAt: { lt: new Date(now - 7 * 24 * H) } },
      ];
    }
  }

  const matching = await db.device.findMany({
    where,
    select: { id: true, imei: true },
  });

  if (matching.length === 0) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "No hay dispositivos que coincidan con los filtros.",
    };
  }

  let deleted = 0;
  let failed = 0;
  const errors: { id: string; name: string; message: string }[] = [];

  for (const d of matching) {
    try {
      const result = await deleteDevice(d.id);
      if (result.ok) {
        deleted++;
      } else {
        failed++;
        errors.push({
          id: d.id,
          name: d.imei,
          message: result.message ?? "Error desconocido",
        });
      }
    } catch (err) {
      failed++;
      errors.push({
        id: d.id,
        name: d.imei,
        message: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }

  revalidatePath("/admin/dispositivos");
  return {
    ok: deleted > 0,
    deleted,
    failed,
    errors,
    message:
      failed === 0
        ? `${deleted} ${deleted === 1 ? "dispositivo eliminado" : "dispositivos eliminados"}`
        : deleted === 0
          ? `Ningún dispositivo se pudo eliminar`
          : `${deleted} ${deleted === 1 ? "eliminado" : "eliminados"} · ${failed} ${failed === 1 ? "falló" : "fallaron"}`,
  };
}
