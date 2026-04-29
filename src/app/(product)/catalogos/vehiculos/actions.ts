"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite, getScopedAccountIds } from "@/lib/permissions";
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
  vehicleType: string;
  mobilityType: string;
  status: string;
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

  if (!VALID_VEHICLE_TYPES.includes(input.vehicleType as VehicleType)) {
    errors.vehicleType = "Tipo inválido";
  }
  if (!VALID_MOBILITY.includes(input.mobilityType as MobilityType)) {
    errors.mobilityType = "Movilidad inválida";
  }
  if (!VALID_STATUS.includes(input.status as AssetStatus)) {
    errors.status = "Estado inválido";
  }

  if (forCreate && !input.accountId) {
    errors.accountId = "Cliente requerido";
  }

  if (Object.keys(errors).length > 0) return { errors };

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
    vehicleType: input.vehicleType as VehicleType,
    mobilityType: input.mobilityType as MobilityType,
    status: input.status as AssetStatus,
  };

  return { errors, data };
}

// ═══════════════════════════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════════════════════════

export async function createAsset(input: AssetInput): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "catalogos")) {
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
  if (!canWrite(session, "catalogos")) {
    return { ok: false, message: "No tenés permiso para editar vehículos." };
  }

  // Verificar que el asset existe Y está en mi scope
  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }

  const existing = await db.asset.findUnique({
    where: { id: assetId },
    select: { id: true, accountId: true },
  });
  if (!existing) {
    return { ok: false, message: "Vehículo no encontrado" };
  }
  if (Array.isArray(scoped) && !scoped.includes(existing.accountId)) {
    return { ok: false, message: "Sin permiso para este vehículo." };
  }

  // En update no permitimos cambiar accountId · forzamos el actual
  input.accountId = existing.accountId;

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
    if (!group || group.accountId !== existing.accountId) {
      return { ok: false, errors: { groupId: "Grupo inválido para este cliente" } };
    }
  }

  // Validar driver
  if (data.currentDriverId) {
    const driver = await db.person.findUnique({
      where: { id: data.currentDriverId },
      select: { accountId: true },
    });
    if (!driver || driver.accountId !== existing.accountId) {
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
      vehicleType: data.vehicleType,
      mobilityType: data.mobilityType,
      status: data.status,
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
  if (!canWrite(session, "catalogos")) {
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
