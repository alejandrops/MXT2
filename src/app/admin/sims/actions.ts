"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════
//  Server actions · CRUD Sim (H3)
//  ─────────────────────────────────────────────────────────────
//  Solo SA y MA tienen permiso (canWrite("backoffice_sims"))
//
//  Reglas de status ↔ deviceId:
//   - STOCK     · deviceId DEBE ser null
//   - ACTIVE    · deviceId requerido
//   - SUSPENDED · deviceId puede ser null (carrier la suspendió y
//                  el técnico la sacó del device) o el actual
//                  (sigue en el device pero sin servicio)
//   - CANCELLED · deviceId DEBE ser null (la SIM ya no se usa)
//
//  ICCID:
//   - Único · validamos antes de crear/actualizar
//   - 19-20 dígitos numéricos
//
//  DELETE:
//   - Hard delete · pero solo si status NO es ACTIVE
//   - Si está activa, hay que primero suspenderla o cancelarla
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
}

export interface SimInput {
  iccid: string;
  phoneNumber: string;
  imsi: string;
  carrier: "MOVISTAR" | "CLARO" | "PERSONAL" | "ENTEL" | "OTHER";
  apn: string;
  dataPlanMb: number;
  status: "STOCK" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  deviceId: string | null;
}

const VALID_CARRIERS = [
  "MOVISTAR",
  "CLARO",
  "PERSONAL",
  "ENTEL",
  "OTHER",
] as const;
const VALID_STATUSES = [
  "STOCK",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
] as const;

const ICCID_RE = /^\d{19,20}$/;

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

interface ValidatedData {
  iccid: string;
  phoneNumber: string | null;
  imsi: string | null;
  carrier: SimInput["carrier"];
  apn: string;
  dataPlanMb: number;
  status: SimInput["status"];
  deviceId: string | null;
}

function validate(input: SimInput): {
  errors: Record<string, string>;
  data?: ValidatedData;
} {
  const errors: Record<string, string> = {};
  const iccid = (input.iccid ?? "").trim();
  const phoneNumber = trimOrNull(input.phoneNumber);
  const imsi = trimOrNull(input.imsi);
  const apn = (input.apn ?? "").trim();

  if (iccid.length === 0) errors.iccid = "Requerido";
  else if (!ICCID_RE.test(iccid))
    errors.iccid = "ICCID debe tener 19 o 20 dígitos numéricos";

  if (apn.length === 0) errors.apn = "Requerido";
  else if (apn.length > 80) errors.apn = "Máximo 80 caracteres";

  if (!VALID_CARRIERS.includes(input.carrier as any))
    errors.carrier = "Carrier inválido";
  if (!VALID_STATUSES.includes(input.status as any))
    errors.status = "Estado inválido";

  if (!Number.isFinite(input.dataPlanMb) || input.dataPlanMb < 1) {
    errors.dataPlanMb = "Cuota inválida (mínimo 1 MB)";
  } else if (input.dataPlanMb > 100_000) {
    errors.dataPlanMb = "Cuota inválida (máximo 100.000 MB)";
  }

  // Validación cruzada · deviceId vs status
  if (input.status === "ACTIVE" && !input.deviceId) {
    errors.deviceId =
      "Una SIM activa debe estar insertada en un dispositivo";
  }
  if (input.status === "STOCK" && input.deviceId) {
    errors.deviceId = "Una SIM en stock no puede estar asignada a un dispositivo";
  }
  if (input.status === "CANCELLED" && input.deviceId) {
    errors.deviceId = "Una SIM cancelada no puede estar asignada a un dispositivo";
  }

  if (phoneNumber && phoneNumber.length > 30) {
    errors.phoneNumber = "Máximo 30 caracteres";
  }
  if (imsi && imsi.length > 30) {
    errors.imsi = "Máximo 30 caracteres";
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    data: {
      iccid,
      phoneNumber,
      imsi,
      carrier: input.carrier,
      apn,
      dataPlanMb: input.dataPlanMb,
      status: input.status,
      deviceId: input.deviceId,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════════════════════════

export async function createSim(input: SimInput): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_sims")) {
    return { ok: false, message: "No tenés permiso para crear SIMs" };
  }

  const { errors, data } = validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // ICCID único
  const dup = await db.sim.findUnique({
    where: { iccid: data.iccid },
    select: { id: true },
  });
  if (dup) {
    return { ok: false, errors: { iccid: "Ya existe una SIM con ese ICCID" } };
  }

  // Si tiene deviceId, validar que exista y NO tenga ya una SIM
  if (data.deviceId) {
    const device = await db.device.findUnique({
      where: { id: data.deviceId },
      select: { id: true, simId: true },
    });
    if (!device) {
      return { ok: false, errors: { deviceId: "Dispositivo inválido" } };
    }
    if (device.simId) {
      return {
        ok: false,
        errors: {
          deviceId: "Ese dispositivo ya tiene una SIM · removela del device antes",
        },
      };
    }
  }

  await db.$transaction(async (tx) => {
    const sim = await tx.sim.create({
      data: {
        iccid: data.iccid,
        phoneNumber: data.phoneNumber,
        imsi: data.imsi,
        carrier: data.carrier,
        apn: data.apn,
        dataPlanMb: data.dataPlanMb,
        status: data.status,
        activatedAt: data.status === "ACTIVE" ? new Date() : null,
      },
    });

    if (data.deviceId) {
      await tx.device.update({
        where: { id: data.deviceId },
        data: { simId: sim.id },
      });
    }
  });

  revalidatePath("/admin/sims");
  revalidatePath("/admin/dispositivos");
  return { ok: true, message: "SIM creada" };
}

// ═══════════════════════════════════════════════════════════════
//  Update
// ═══════════════════════════════════════════════════════════════

export async function updateSim(
  simId: string,
  input: SimInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_sims")) {
    return { ok: false, message: "No tenés permiso para editar SIMs" };
  }

  const existing = await db.sim.findUnique({
    where: { id: simId },
    select: {
      id: true,
      iccid: true,
      status: true,
      device: { select: { id: true } },
    },
  });
  if (!existing) return { ok: false, message: "SIM no encontrada" };

  const { errors, data } = validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // ICCID único (excluyendo el propio)
  if (data.iccid !== existing.iccid) {
    const conflict = await db.sim.findUnique({
      where: { iccid: data.iccid },
      select: { id: true },
    });
    if (conflict) {
      return {
        ok: false,
        errors: { iccid: "Ya existe otra SIM con ese ICCID" },
      };
    }
  }

  // Validar deviceId destino
  if (data.deviceId) {
    const targetDevice = await db.device.findUnique({
      where: { id: data.deviceId },
      select: { id: true, simId: true },
    });
    if (!targetDevice) {
      return { ok: false, errors: { deviceId: "Dispositivo inválido" } };
    }
    // Si ya tiene una SIM Y NO es esta SIM
    if (targetDevice.simId && targetDevice.simId !== simId) {
      return {
        ok: false,
        errors: {
          deviceId: "Ese dispositivo ya tiene otra SIM · removela primero",
        },
      };
    }
  }

  const wasActive = existing.status === "ACTIVE";
  const becomesActive = data.status === "ACTIVE";

  await db.$transaction(async (tx) => {
    // 1. Si la SIM tenía un device pero ahora no o cambia, des-asignar
    //    el device anterior (poner simId: null)
    const previousDeviceId = existing.device?.id ?? null;
    if (previousDeviceId && previousDeviceId !== data.deviceId) {
      await tx.device.update({
        where: { id: previousDeviceId },
        data: { simId: null },
      });
    }

    // 2. Actualizar la SIM con sus campos
    await tx.sim.update({
      where: { id: simId },
      data: {
        iccid: data.iccid,
        phoneNumber: data.phoneNumber,
        imsi: data.imsi,
        carrier: data.carrier,
        apn: data.apn,
        dataPlanMb: data.dataPlanMb,
        status: data.status,
        // Si pasa de no-ACTIVE a ACTIVE, marcar fecha de activación
        ...(becomesActive && !wasActive
          ? { activatedAt: new Date() }
          : {}),
      },
    });

    // 3. Asignar al device nuevo (si corresponde)
    if (data.deviceId && data.deviceId !== previousDeviceId) {
      await tx.device.update({
        where: { id: data.deviceId },
        data: { simId: simId },
      });
    }
  });

  revalidatePath("/admin/sims");
  revalidatePath("/admin/dispositivos");
  return { ok: true, message: "SIM actualizada" };
}

// ═══════════════════════════════════════════════════════════════
//  Delete · hard, bloqueado si está ACTIVE
// ═══════════════════════════════════════════════════════════════

export async function deleteSim(simId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_sims")) {
    return { ok: false, message: "No tenés permiso para eliminar SIMs" };
  }

  const existing = await db.sim.findUnique({
    where: { id: simId },
    select: {
      id: true,
      iccid: true,
      status: true,
      device: { select: { id: true } },
    },
  });
  if (!existing) return { ok: false, message: "SIM no encontrada" };

  if (existing.status === "ACTIVE") {
    return {
      ok: false,
      message: `No se puede eliminar una SIM activa. Cambialá a "Suspendida" o "Cancelada" antes de eliminarla.`,
    };
  }

  await db.$transaction(async (tx) => {
    // Si por alguna razón está enlazada a un device (ej. SUSPENDED
    // que mantiene el link), desenlazar primero
    if (existing.device) {
      await tx.device.update({
        where: { id: existing.device.id },
        data: { simId: null },
      });
    }
    await tx.sim.delete({ where: { id: simId } });
  });

  revalidatePath("/admin/sims");
  revalidatePath("/admin/dispositivos");
  return { ok: true, message: `SIM ${existing.iccid} eliminada` };
}

// ═══════════════════════════════════════════════════════════════
//  Bulk delete + Delete all matching · H5b
// ═══════════════════════════════════════════════════════════════

import type { Prisma } from "@prisma/client";

export async function bulkDeleteAdminSims(
  simIds: string[],
): Promise<{
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_sims")) {
    return {
      ok: false,
      deleted: 0,
      failed: simIds.length,
      errors: [],
      message: "No tenés permiso para eliminar SIMs",
    };
  }

  if (simIds.length === 0) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "Seleccioná al menos una SIM.",
    };
  }

  let deleted = 0;
  let failed = 0;
  const errors: { id: string; name: string; message: string }[] = [];

  for (const id of simIds) {
    const s = await db.sim.findUnique({
      where: { id },
      select: { iccid: true },
    });
    const name = s?.iccid ?? id;
    try {
      const result = await deleteSim(id);
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

  revalidatePath("/admin/sims");
  return {
    ok: deleted > 0,
    deleted,
    failed,
    errors,
    message:
      failed === 0
        ? `${deleted} ${deleted === 1 ? "SIM eliminada" : "SIMs eliminadas"}`
        : deleted === 0
          ? `Ninguna SIM se pudo eliminar`
          : `${deleted} ${deleted === 1 ? "eliminada" : "eliminadas"} · ${failed} ${failed === 1 ? "falló" : "fallaron"}`,
  };
}

export interface DeleteAllMatchingSimsFilters {
  search: string | null;
  status: string | null;
  carrier: string | null;
}

export async function deleteAllMatchingSims(
  filters: DeleteAllMatchingSimsFilters,
): Promise<{
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_sims")) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "No tenés permiso para eliminar SIMs",
    };
  }

  const where: Prisma.SimWhereInput = {};
  if (filters.search) {
    where.OR = [
      { iccid: { contains: filters.search } },
      { phoneNumber: { contains: filters.search } },
      { imsi: { contains: filters.search } },
    ];
  }
  if (filters.status) where.status = filters.status as any;
  if (filters.carrier) where.carrier = filters.carrier as any;

  const matching = await db.sim.findMany({
    where,
    select: { id: true, iccid: true },
  });

  if (matching.length === 0) {
    return {
      ok: false,
      deleted: 0,
      failed: 0,
      errors: [],
      message: "No hay SIMs que coincidan con los filtros.",
    };
  }

  let deleted = 0;
  let failed = 0;
  const errors: { id: string; name: string; message: string }[] = [];

  for (const s of matching) {
    try {
      const result = await deleteSim(s.id);
      if (result.ok) {
        deleted++;
      } else {
        failed++;
        errors.push({
          id: s.id,
          name: s.iccid,
          message: result.message ?? "Error desconocido",
        });
      }
    } catch (err) {
      failed++;
      errors.push({
        id: s.id,
        name: s.iccid,
        message: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }

  revalidatePath("/admin/sims");
  return {
    ok: deleted > 0,
    deleted,
    failed,
    errors,
    message:
      failed === 0
        ? `${deleted} ${deleted === 1 ? "SIM eliminada" : "SIMs eliminadas"}`
        : deleted === 0
          ? `Ninguna SIM se pudo eliminar`
          : `${deleted} ${deleted === 1 ? "eliminada" : "eliminadas"} · ${failed} ${failed === 1 ? "falló" : "fallaron"}`,
  };
}
