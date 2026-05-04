// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════
//  Server actions · Backoffice Vehículos (H7c-2)
//  ─────────────────────────────────────────────────────────────
//  Permisos · canWrite("backoffice_vehiculos") · solo SA/MA.
//  DELETE es HARD delete (libera devices, borra trips/positions/etc)
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
}

export interface AdminAssetUpdateInput {
  name: string;
  plate: string;
  vin: string;
  make: string;
  model: string;
  year: number | null;
  vehicleType:
    | "GENERIC"
    | "CAR"
    | "TRUCK"
    | "MOTORCYCLE"
    | "HEAVY_MACHINERY"
    | "TRAILER"
    | "SILO";
  mobilityType: "MOBILE" | "FIXED";
  initialOdometerKm: number | null;
  accountId: string;
  groupId: string | null;
  currentDriverId: string | null;
  status: "MOVING" | "IDLE" | "STOPPED" | "OFFLINE" | "MAINTENANCE";
}

const VALID_VEHICLE_TYPES = [
  "GENERIC",
  "CAR",
  "TRUCK",
  "MOTORCYCLE",
  "HEAVY_MACHINERY",
  "TRAILER",
  "SILO",
] as const;

const VALID_STATUSES = [
  "MOVING",
  "IDLE",
  "STOPPED",
  "OFFLINE",
  "MAINTENANCE",
] as const;

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function validate(input: AdminAssetUpdateInput): {
  errors: Record<string, string>;
  data?: {
    name: string;
    plate: string | null;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    vehicleType: AdminAssetUpdateInput["vehicleType"];
    mobilityType: AdminAssetUpdateInput["mobilityType"];
    initialOdometerKm: number | null;
    accountId: string;
    groupId: string | null;
    currentDriverId: string | null;
    status: AdminAssetUpdateInput["status"];
  };
} {
  const errors: Record<string, string> = {};
  const name = (input.name ?? "").trim();
  const plate = trimOrNull(input.plate)?.toUpperCase() ?? null;
  const vin = trimOrNull(input.vin)?.toUpperCase() ?? null;
  const make = trimOrNull(input.make);
  const model = trimOrNull(input.model);

  if (name.length === 0) errors.name = "Requerido";
  else if (name.length > 80) errors.name = "Máximo 80 caracteres";

  if (plate && plate.length > 20) errors.plate = "Máximo 20 caracteres";
  if (vin && vin.length > 30) errors.vin = "Máximo 30 caracteres";

  if (input.year !== null) {
    if (input.year < 1900 || input.year > 2100) {
      errors.year = "Año inválido (1900-2100)";
    }
  }

  if (
    input.initialOdometerKm !== null &&
    (input.initialOdometerKm < 0 || input.initialOdometerKm > 9_999_999)
  ) {
    errors.initialOdometerKm = "Valor inválido (0 - 9.999.999 km)";
  }

  if (!VALID_VEHICLE_TYPES.includes(input.vehicleType)) {
    errors.vehicleType = "Tipo inválido";
  }

  if (!VALID_STATUSES.includes(input.status)) {
    errors.status = "Estado inválido";
  }

  if (!input.accountId) errors.accountId = "Cliente requerido";

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    data: {
      name,
      plate,
      vin,
      make,
      model,
      year: input.year,
      vehicleType: input.vehicleType,
      mobilityType: input.mobilityType,
      initialOdometerKm: input.initialOdometerKm,
      accountId: input.accountId,
      groupId: input.groupId,
      currentDriverId: input.currentDriverId,
      status: input.status,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  Update · campos comerciales del asset
// ═══════════════════════════════════════════════════════════════

export async function updateAdminAsset(
  assetId: string,
  input: AdminAssetUpdateInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_vehiculos")) {
    return { ok: false, message: "No tenés permiso para editar vehículos" };
  }

  const existing = await db.asset.findUnique({
    where: { id: assetId },
    select: { id: true, plate: true, vin: true },
  });
  if (!existing) return { ok: false, message: "Vehículo no encontrado" };

  const { errors, data } = validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  if (data.plate && data.plate !== existing.plate) {
    const conflict = await db.asset.findFirst({
      where: { plate: data.plate, NOT: { id: assetId } },
      select: { id: true },
    });
    if (conflict) {
      return {
        ok: false,
        errors: { plate: "Ya existe otro vehículo con esa patente" },
      };
    }
  }

  if (data.vin && data.vin !== existing.vin) {
    const conflict = await db.asset.findFirst({
      where: { vin: data.vin, NOT: { id: assetId } },
      select: { id: true },
    });
    if (conflict) {
      return {
        ok: false,
        errors: { vin: "Ya existe otro vehículo con ese VIN" },
      };
    }
  }

  const accountExists = await db.account.findUnique({
    where: { id: data.accountId },
    select: { id: true },
  });
  if (!accountExists)
    return { ok: false, errors: { accountId: "Cliente inválido" } };

  if (data.groupId) {
    const group = await db.group.findUnique({
      where: { id: data.groupId },
      select: { accountId: true },
    });
    if (!group || group.accountId !== data.accountId) {
      return {
        ok: false,
        errors: { groupId: "El grupo no pertenece al cliente seleccionado" },
      };
    }
  }
  if (data.currentDriverId) {
    const driver = await db.person.findUnique({
      where: { id: data.currentDriverId },
      select: { accountId: true },
    });
    if (!driver || driver.accountId !== data.accountId) {
      return {
        ok: false,
        errors: {
          currentDriverId: "El conductor no pertenece al cliente seleccionado",
        },
      };
    }
  }

  await db.asset.update({
    where: { id: assetId },
    data: {
      name: data.name,
      plate: data.plate,
      vin: data.vin,
      make: data.make,
      model: data.model,
      year: data.year,
      vehicleType: data.vehicleType as any,
      mobilityType: data.mobilityType as any,
      initialOdometerKm: data.initialOdometerKm,
      accountId: data.accountId,
      groupId: data.groupId,
      currentDriverId: data.currentDriverId,
      status: data.status as any,
    },
  });

  revalidatePath("/admin/vehiculos");
  revalidatePath("/catalogos/vehiculos");
  return { ok: true, message: "Vehículo actualizado" };
}

// ═══════════════════════════════════════════════════════════════
//  Delete · HARD · libera devices, borra trips/positions/etc
// ═══════════════════════════════════════════════════════════════

export async function deleteAdminAsset(
  assetId: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_vehiculos")) {
    return { ok: false, message: "No tenés permiso para eliminar vehículos" };
  }

  const existing = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      name: true,
      devices: { select: { id: true } },
    },
  });
  if (!existing) return { ok: false, message: "Vehículo no encontrado" };

  await db.$transaction(async (tx) => {
    if (existing.devices.length > 0) {
      await tx.device.updateMany({
        where: { assetId },
        data: { assetId: null, status: "IN_REPAIR", isPrimary: false },
      });
    }
    await tx.alarm.deleteMany({ where: { assetId } });
    await tx.event.deleteMany({ where: { assetId } });
    await tx.trip.deleteMany({ where: { assetId } });
    await tx.livePosition.deleteMany({ where: { assetId } });
    await tx.position.deleteMany({ where: { assetId } });
    await tx.assetDriverDay.deleteMany({ where: { assetId } });
    await tx.assetWeeklyStats.deleteMany({ where: { assetId } });
    await tx.asset.delete({ where: { id: assetId } });
  });

  revalidatePath("/admin/vehiculos");
  revalidatePath("/catalogos/vehiculos");
  return { ok: true, message: `Vehículo "${existing.name}" eliminado` };
}

// ═══════════════════════════════════════════════════════════════
//  Bulk delete · NO all-or-nothing
// ═══════════════════════════════════════════════════════════════

export async function bulkDeleteAdminAssets(
  assetIds: string[],
): Promise<{
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_vehiculos")) {
    return {
      ok: false,
      deleted: 0,
      failed: assetIds.length,
      errors: [],
      message: "No tenés permiso para eliminar vehículos",
    };
  }

  if (assetIds.length === 0) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "Seleccioná al menos un vehículo.",
    };
  }

  let deleted = 0;
  let failed = 0;
  const errors: { id: string; name: string; message: string }[] = [];

  for (const id of assetIds) {
    const asset = await db.asset.findUnique({
      where: { id },
      select: { name: true },
    });
    const assetName = asset?.name ?? id;

    try {
      const result = await deleteAdminAsset(id);
      if (result.ok) {
        deleted++;
      } else {
        failed++;
        errors.push({
          id,
          name: assetName,
          message: result.message ?? "Error desconocido",
        });
      }
    } catch (err) {
      failed++;
      errors.push({
        id,
        name: assetName,
        message: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }

  revalidatePath("/admin/vehiculos");
  return {
    ok: deleted > 0,
    deleted,
    failed,
    errors,
    message:
      failed === 0
        ? `${deleted} ${deleted === 1 ? "vehículo eliminado" : "vehículos eliminados"}`
        : deleted === 0
          ? `Ningún vehículo se pudo eliminar`
          : `${deleted} ${deleted === 1 ? "eliminado" : "eliminados"} · ${failed} ${failed === 1 ? "falló" : "fallaron"}`,
  };
}


// ═══════════════════════════════════════════════════════════════
//  Delete all matching · "eliminar todo lo filtrado" (H5b)
//  ─────────────────────────────────────────────────────────────
//  Recibe los mismos filtros que listAssetsForAdmin · construye
//  la query, obtiene los IDs y los borra uno a uno reusando
//  deleteAdminAsset.
//
//  Performance: si el filtro matchea 10k items, va a hacer 10k
//  llamadas. Para esta primera versión es OK · más adelante
//  podemos optimizar con un único transaction.
// ═══════════════════════════════════════════════════════════════

import type { Prisma } from "@prisma/client";

export interface DeleteAllMatchingAssetsFilters {
  search: string | null;
  accountId: string | null;
  vehicleType: string | null;
  deviceVendor: string | null;
  deviceStatus: string | null;
  withoutDevice: boolean;
}

export async function deleteAllMatchingAssets(
  filters: DeleteAllMatchingAssetsFilters,
): Promise<{
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_vehiculos")) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "No tenés permiso para eliminar vehículos",
    };
  }

  // Construir el where igual que listAssetsForAdmin
  const where: Prisma.AssetWhereInput = {};
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { plate: { contains: filters.search } },
      { vin: { contains: filters.search } },
    ];
  }
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.vehicleType) where.vehicleType = filters.vehicleType as any;

  if (filters.withoutDevice) {
    where.devices = { none: {} };
  } else if (filters.deviceVendor || filters.deviceStatus) {
    where.devices = {
      some: {
        ...(filters.deviceVendor ? { vendor: filters.deviceVendor as any } : {}),
        ...(filters.deviceStatus
          ? { status: filters.deviceStatus as any }
          : {}),
      },
    };
  }

  const matching = await db.asset.findMany({
    where,
    select: { id: true, name: true },
  });

  if (matching.length === 0) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "No hay vehículos que coincidan con los filtros.",
    };
  }

  let deleted = 0;
  let failed = 0;
  const errors: { id: string; name: string; message: string }[] = [];

  for (const a of matching) {
    try {
      const result = await deleteAdminAsset(a.id);
      if (result.ok) {
        deleted++;
      } else {
        failed++;
        errors.push({
          id: a.id,
          name: a.name,
          message: result.message ?? "Error desconocido",
        });
      }
    } catch (err) {
      failed++;
      errors.push({
        id: a.id,
        name: a.name,
        message: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }

  revalidatePath("/admin/vehiculos");
  revalidatePath("/catalogos/vehiculos");
  return {
    ok: deleted > 0,
    deleted,
    failed,
    errors,
    message:
      failed === 0
        ? `${deleted} ${deleted === 1 ? "vehículo eliminado" : "vehículos eliminados"}`
        : deleted === 0
          ? `Ningún vehículo se pudo eliminar`
          : `${deleted} ${deleted === 1 ? "eliminado" : "eliminados"} · ${failed} ${failed === 1 ? "falló" : "fallaron"}`,
  };
}
