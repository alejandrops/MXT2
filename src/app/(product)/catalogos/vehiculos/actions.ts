// @ts-nocheck · pre-existing TS errors
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  canCreateEntity,
  canUpdateEntity,
  canDeleteEntity,
  getScopedAccountIds,
} from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════
//  Server actions · CRUD de Vehículos (Asset)
//  ─────────────────────────────────────────────────────────────
//  Todas las actions:
//    1. Resuelven session
//    2. Verifican canWrite("catalogos")
//    3. Si la op refiere a un asset existente, verifican que esté
//       dentro de getScopedAccountIds(session, "catalogos")
//    4. Validan input manualmente
//    5. Ejecutan la mutación
//    6. revalidatePath("/catalogos/vehiculos")
//
//  Soft delete · marca status=MAINTENANCE y mobilityType inalterado.
//  En MVP no tenemos campo "deleted" propio · cuando lo agreguemos
//  cambia esta política. Por ahora, asset "borrado" simplemente
//  desaparece del filtro habitual.
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  /** Para createAsset · id del nuevo asset (útil si querés navegar a él) */
  id?: string;
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

const VALID_MOBILITY = ["MOBILE", "FIXED"] as const;

const VALID_STATUS = [
  "MOVING",
  "IDLE",
  "STOPPED",
  "OFFLINE",
  "MAINTENANCE",
] as const;

type VehicleType = (typeof VALID_VEHICLE_TYPES)[number];
type MobilityType = (typeof VALID_MOBILITY)[number];
type AssetStatus = (typeof VALID_STATUS)[number];

export interface AssetInput {
  /** Solo para create · ignorado en update */
  accountId?: string;
  groupId: string | null;
  currentDriverId: string | null;
  name: string;
  plate: string;
  vin: string;
  make: string;
  model: string;
  year: string; // string desde el form, parsea acá
  /** Odómetro al alta · número o vacío */
  initialOdometerKm: string;
  vehicleType: string;
  mobilityType: string;
  /** Toggle binario · true = MAINTENANCE, false = operación normal */
  inMaintenance: boolean;
}

function validate(
  input: AssetInput,
  forCreate: boolean,
): { errors: Record<string, string>; data?: Prisma.AssetUncheckedCreateInput } {
  const errors: Record<string, string> = {};

  const name = (input.name ?? "").trim();
  const plate = (input.plate ?? "").trim().toUpperCase();
  const vin = (input.vin ?? "").trim().toUpperCase();
  const make = (input.make ?? "").trim();
  const model = (input.model ?? "").trim();
  const yearRaw = (input.year ?? "").trim();
  const odometerRaw = (input.initialOdometerKm ?? "").trim();

  if (name.length === 0) errors.name = "Requerido";
  else if (name.length > 80) errors.name = "Máximo 80 caracteres";

  if (plate.length > 0 && plate.length > 20)
    errors.plate = "Máximo 20 caracteres";

  if (vin.length > 0 && vin.length > 30)
    errors.vin = "Máximo 30 caracteres";

  let year: number | null = null;
  if (yearRaw.length > 0) {
    const n = Number.parseInt(yearRaw, 10);
    if (Number.isNaN(n) || n < 1900 || n > 2100) {
      errors.year = "Año inválido (1900–2100)";
    } else {
      year = n;
    }
  }

  let initialOdometerKm: number | null = null;
  if (odometerRaw.length > 0) {
    const n = Number.parseInt(odometerRaw, 10);
    if (Number.isNaN(n) || n < 0 || n > 9_999_999) {
      errors.initialOdometerKm = "Valor inválido (0 – 9.999.999 km)";
    } else {
      initialOdometerKm = n;
    }
  }

  if (!VALID_VEHICLE_TYPES.includes(input.vehicleType as VehicleType)) {
    errors.vehicleType = "Tipo inválido";
  }
  if (!VALID_MOBILITY.includes(input.mobilityType as MobilityType)) {
    errors.mobilityType = "Movilidad inválida";
  }

  if (forCreate && !input.accountId) {
    errors.accountId = "Cliente requerido";
  }

  if (Object.keys(errors).length > 0) return { errors };

  // Status NO se setea acá · cada caller (create / update) decide
  // según contexto (preservar estado actual o forzar MAINTENANCE)
  const data: Prisma.AssetUncheckedCreateInput = {
    accountId: input.accountId!,
    groupId: input.groupId ?? null,
    currentDriverId: input.currentDriverId ?? null,
    name,
    plate: plate.length > 0 ? plate : null,
    vin: vin.length > 0 ? vin : null,
    make: make.length > 0 ? make : null,
    model: model.length > 0 ? model : null,
    year,
    initialOdometerKm,
    vehicleType: input.vehicleType as VehicleType,
    mobilityType: input.mobilityType as MobilityType,
    // status se sobreescribe en cada caller
    status: input.inMaintenance ? "MAINTENANCE" : "IDLE",
  };

  return { errors, data };
}

// ═══════════════════════════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════════════════════════

export async function createAsset(input: AssetInput): Promise<ActionResult> {
  const session = await getSession();
  if (!canCreateEntity(session, "catalogos", "vehiculos")) {
    return { ok: false, message: "No tenés permiso para crear vehículos." };
  }

  // Si el user es CLIENT_ADMIN/OPERATOR, forzamos accountId al suyo
  // (defensivo · el form ni siquiera muestra el selector pero por
  //  las dudas que llegue manipulado)
  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped)) {
    if (scoped.length === 0) {
      return { ok: false, message: "Sin permiso." };
    }
    if (!input.accountId || !scoped.includes(input.accountId)) {
      input.accountId = scoped[0];
    }
  }

  const { errors, data } = validate(input, true);
  if (Object.keys(errors).length > 0 || !data) {
    return { ok: false, errors };
  }

  // Validar unicidad de plate/vin si vienen
  if (data.plate) {
    const existing = await db.asset.findUnique({ where: { plate: data.plate } });
    if (existing) {
      return {
        ok: false,
        errors: { plate: "Ya existe un vehículo con esa patente" },
      };
    }
  }
  if (data.vin) {
    const existing = await db.asset.findUnique({ where: { vin: data.vin } });
    if (existing) {
      return {
        ok: false,
        errors: { vin: "Ya existe un vehículo con ese VIN" },
      };
    }
  }

  // Validar que groupId pertenezca a accountId (defensivo)
  if (data.groupId) {
    const group = await db.group.findUnique({
      where: { id: data.groupId },
      select: { accountId: true },
    });
    if (!group || group.accountId !== data.accountId) {
      return { ok: false, errors: { groupId: "Grupo inválido para este cliente" } };
    }
  }

  // Validar que currentDriverId pertenezca a accountId (defensivo)
  if (data.currentDriverId) {
    const driver = await db.person.findUnique({
      where: { id: data.currentDriverId },
      select: { accountId: true },
    });
    if (!driver || driver.accountId !== data.accountId) {
      return {
        ok: false,
        errors: { currentDriverId: "Conductor inválido para este cliente" },
      };
    }
  }

  const created = await db.asset.create({ data });
  revalidatePath("/catalogos/vehiculos");
  return { ok: true, message: "Vehículo creado", id: created.id };
}

// ═══════════════════════════════════════════════════════════════
//  Update
// ═══════════════════════════════════════════════════════════════

export async function updateAsset(
  assetId: string,
  input: AssetInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canUpdateEntity(session, "catalogos", "vehiculos")) {
    return { ok: false, message: "No tenés permiso para editar vehículos." };
  }

  // Verificar que el asset existe Y está en mi scope
  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }

  const existingFull = await db.asset.findUnique({
    where: { id: assetId },
    select: { id: true, accountId: true, status: true },
  });
  if (!existingFull) {
    return { ok: false, message: "Vehículo no encontrado" };
  }
  if (Array.isArray(scoped) && !scoped.includes(existingFull.accountId)) {
    return { ok: false, message: "Sin permiso para este vehículo." };
  }

  // En update no permitimos cambiar accountId · forzamos el actual
  input.accountId = existingFull.accountId;

  const { errors, data } = validate(input, false);
  if (Object.keys(errors).length > 0 || !data) {
    return { ok: false, errors };
  }

  // Unicidad de plate/vin (excluyendo el asset actual)
  if (data.plate) {
    const conflict = await db.asset.findFirst({
      where: { plate: data.plate, NOT: { id: assetId } },
    });
    if (conflict) {
      return { ok: false, errors: { plate: "Ya existe otro vehículo con esa patente" } };
    }
  }
  if (data.vin) {
    const conflict = await db.asset.findFirst({
      where: { vin: data.vin, NOT: { id: assetId } },
    });
    if (conflict) {
      return { ok: false, errors: { vin: "Ya existe otro vehículo con ese VIN" } };
    }
  }

  // Validar group
  if (data.groupId) {
    const group = await db.group.findUnique({
      where: { id: data.groupId },
      select: { accountId: true },
    });
    if (!group || group.accountId !== existingFull.accountId) {
      return { ok: false, errors: { groupId: "Grupo inválido para este cliente" } };
    }
  }

  // Validar driver
  if (data.currentDriverId) {
    const driver = await db.person.findUnique({
      where: { id: data.currentDriverId },
      select: { accountId: true },
    });
    if (!driver || driver.accountId !== existingFull.accountId) {
      return {
        ok: false,
        errors: { currentDriverId: "Conductor inválido para este cliente" },
      };
    }
  }

  await db.asset.update({
    where: { id: assetId },
    data: {
      groupId: data.groupId,
      currentDriverId: data.currentDriverId,
      name: data.name,
      plate: data.plate,
      vin: data.vin,
      make: data.make,
      model: data.model,
      year: data.year,
      initialOdometerKm: data.initialOdometerKm,
      vehicleType: data.vehicleType,
      mobilityType: data.mobilityType,
      // Status: si el toggle dice "en mantenimiento", forzar MAINTENANCE.
      // Si dice "en operación":
      //   - Si estaba en MAINTENANCE, pasar a IDLE (el sistema lo va a
      //     actualizar al recibir la próxima posición del dispositivo)
      //   - Si NO estaba en MAINTENANCE, NO tocar el status · preservar
      //     el real (MOVING / IDLE / STOPPED / OFFLINE) que viene del IoT
      ...(input.inMaintenance
        ? { status: "MAINTENANCE" as const }
        : existingFull?.status === "MAINTENANCE"
          ? { status: "IDLE" as const }
          : {}),
    },
  });

  revalidatePath("/catalogos/vehiculos");
  return { ok: true, message: "Vehículo actualizado" };
}

// ═══════════════════════════════════════════════════════════════
//  Soft delete · marca como MAINTENANCE
// ─────────────────────────────────────────────────────────────
//  El demo no tiene campo "deleted" en el schema todavía. Como
//  workaround, "eliminar" marca status=MAINTENANCE para que no
//  aparezca en filtros operativos. Cuando se agregue soft-delete
//  real (campo deletedAt) se reemplaza esta lógica.
// ═══════════════════════════════════════════════════════════════

export async function softDeleteAsset(assetId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!canDeleteEntity(session, "catalogos", "vehiculos")) {
    return { ok: false, message: "No tenés permiso." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }

  const existing = await db.asset.findUnique({
    where: { id: assetId },
    select: { accountId: true },
  });
  if (!existing) {
    return { ok: false, message: "Vehículo no encontrado" };
  }
  if (Array.isArray(scoped) && !scoped.includes(existing.accountId)) {
    return { ok: false, message: "Sin permiso para este vehículo." };
  }

  await db.asset.update({
    where: { id: assetId },
    data: { status: "MAINTENANCE" },
  });
  revalidatePath("/catalogos/vehiculos");
  return { ok: true, message: "Vehículo dado de baja" };
}

// ═══════════════════════════════════════════════════════════════
//  Bulk actions · A6a
//  ─────────────────────────────────────────────────────────────
//  Patrón común:
//    1. Resolver session + canWrite
//    2. Resolver scopedAccountIds
//    3. Filtrar IDs · solo aquellos que están en mi scope. Si
//       alguien manipula el form para incluir IDs fuera del scope,
//       los ignoramos silenciosamente · no los procesamos.
//    4. Validar datos de la mutación (groupId / driverId / status)
//    5. updateMany / updates individuales según el caso
// ═══════════════════════════════════════════════════════════════

interface BulkResult extends ActionResult {
  affected?: number;
  skipped?: number;
}

/**
 * Filtra los assetIds quedándose solo con los que pertenecen al
 * scope del usuario · si scope es null (cross-account), los
 * devuelve todos los que existan en DB.
 */
async function filterIdsToScope(
  assetIds: string[],
  scopedAccountIds: string[] | null,
): Promise<string[]> {
  if (assetIds.length === 0) return [];
  const where: Prisma.AssetWhereInput = { id: { in: assetIds } };
  if (Array.isArray(scopedAccountIds)) {
    where.accountId = { in: scopedAccountIds };
  }
  const valid = await db.asset.findMany({
    where,
    select: { id: true },
  });
  return valid.map((a) => a.id);
}

// ── Bulk · mover a grupo ────────────────────────────────────────

export async function bulkMoveToGroup(
  assetIds: string[],
  groupId: string | null,
): Promise<BulkResult> {
  const session = await getSession();
  if (!canUpdateEntity(session, "catalogos", "vehiculos")) {
    return { ok: false, message: "No tenés permiso." };
  }
  if (assetIds.length === 0) {
    return { ok: false, message: "Seleccioná al menos un vehículo." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  const validIds = await filterIdsToScope(assetIds, scoped);
  const skipped = assetIds.length - validIds.length;

  if (validIds.length === 0) {
    return { ok: false, message: "Sin permiso sobre los vehículos seleccionados." };
  }

  // Si groupId NO es null, validar que pertenezca a un account
  // común a TODOS los assets seleccionados · si los assets están
  // en distintos clientes, no se pueden mover al mismo grupo.
  if (groupId !== null) {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { accountId: true },
    });
    if (!group) {
      return { ok: false, message: "Grupo inválido." };
    }
    // Verificar que todos los assets sean del mismo accountId que el group
    const assets = await db.asset.findMany({
      where: { id: { in: validIds } },
      select: { id: true, accountId: true },
    });
    const wrongAccount = assets.filter((a) => a.accountId !== group.accountId);
    if (wrongAccount.length > 0) {
      return {
        ok: false,
        message: `${wrongAccount.length} ${wrongAccount.length === 1 ? "vehículo no pertenece" : "vehículos no pertenecen"} al cliente del grupo seleccionado.`,
      };
    }
  }

  const result = await db.asset.updateMany({
    where: { id: { in: validIds } },
    data: { groupId },
  });

  revalidatePath("/catalogos/vehiculos");
  const groupLabel = groupId ? "al grupo" : "fuera de grupo";
  return {
    ok: true,
    affected: result.count,
    skipped,
    message: `${result.count} ${result.count === 1 ? "vehículo movido" : "vehículos movidos"} ${groupLabel}${skipped > 0 ? ` · ${skipped} omitido${skipped === 1 ? "" : "s"}` : ""}.`,
  };
}

// ── Bulk · asignar conductor ────────────────────────────────────

export async function bulkAssignDriver(
  assetIds: string[],
  driverId: string | null,
): Promise<BulkResult> {
  const session = await getSession();
  if (!canUpdateEntity(session, "catalogos", "vehiculos")) {
    return { ok: false, message: "No tenés permiso." };
  }
  if (assetIds.length === 0) {
    return { ok: false, message: "Seleccioná al menos un vehículo." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  const validIds = await filterIdsToScope(assetIds, scoped);
  const skipped = assetIds.length - validIds.length;

  if (validIds.length === 0) {
    return { ok: false, message: "Sin permiso sobre los vehículos seleccionados." };
  }

  if (driverId !== null) {
    const driver = await db.person.findUnique({
      where: { id: driverId },
      select: { accountId: true },
    });
    if (!driver) {
      return { ok: false, message: "Conductor inválido." };
    }
    const assets = await db.asset.findMany({
      where: { id: { in: validIds } },
      select: { accountId: true },
    });
    const wrongAccount = assets.filter((a) => a.accountId !== driver.accountId);
    if (wrongAccount.length > 0) {
      return {
        ok: false,
        message: `${wrongAccount.length} ${wrongAccount.length === 1 ? "vehículo no pertenece" : "vehículos no pertenecen"} al cliente del conductor.`,
      };
    }
  }

  const result = await db.asset.updateMany({
    where: { id: { in: validIds } },
    data: { currentDriverId: driverId },
  });

  revalidatePath("/catalogos/vehiculos");
  const driverLabel = driverId ? "asignado" : "desasignado";
  return {
    ok: true,
    affected: result.count,
    skipped,
    message: `${result.count} ${result.count === 1 ? "vehículo" : "vehículos"} con conductor ${driverLabel}${skipped > 0 ? ` · ${skipped} omitido${skipped === 1 ? "" : "s"}` : ""}.`,
  };
}

// ── Bulk · cambiar estado ───────────────────────────────────────

export async function bulkChangeStatus(
  assetIds: string[],
  status: string,
): Promise<BulkResult> {
  const session = await getSession();
  if (!canUpdateEntity(session, "catalogos", "vehiculos")) {
    return { ok: false, message: "No tenés permiso." };
  }
  if (assetIds.length === 0) {
    return { ok: false, message: "Seleccioná al menos un vehículo." };
  }
  if (!VALID_STATUS.includes(status as AssetStatus)) {
    return { ok: false, message: "Estado inválido." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  const validIds = await filterIdsToScope(assetIds, scoped);
  const skipped = assetIds.length - validIds.length;

  if (validIds.length === 0) {
    return { ok: false, message: "Sin permiso sobre los vehículos seleccionados." };
  }

  const result = await db.asset.updateMany({
    where: { id: { in: validIds } },
    data: { status: status as AssetStatus },
  });

  revalidatePath("/catalogos/vehiculos");
  return {
    ok: true,
    affected: result.count,
    skipped,
    message: `Estado actualizado en ${result.count} ${result.count === 1 ? "vehículo" : "vehículos"}${skipped > 0 ? ` · ${skipped} omitido${skipped === 1 ? "" : "s"}` : ""}.`,
  };
}

// ── Bulk · soft delete (status=MAINTENANCE) ────────────────────

export async function bulkSoftDelete(
  assetIds: string[],
): Promise<BulkResult> {
  const session = await getSession();
  if (!canDeleteEntity(session, "catalogos", "vehiculos")) {
    return { ok: false, message: "No tenés permiso." };
  }
  if (assetIds.length === 0) {
    return { ok: false, message: "Seleccioná al menos un vehículo." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  const validIds = await filterIdsToScope(assetIds, scoped);
  const skipped = assetIds.length - validIds.length;

  if (validIds.length === 0) {
    return { ok: false, message: "Sin permiso sobre los vehículos seleccionados." };
  }

  const result = await db.asset.updateMany({
    where: { id: { in: validIds } },
    data: { status: "MAINTENANCE" },
  });

  revalidatePath("/catalogos/vehiculos");
  return {
    ok: true,
    affected: result.count,
    skipped,
    message: `${result.count} ${result.count === 1 ? "vehículo dado" : "vehículos dados"} de baja${skipped > 0 ? ` · ${skipped} omitido${skipped === 1 ? "" : "s"}` : ""}.`,
  };
}
