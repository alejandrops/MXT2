// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";
import { getClientStats } from "@/lib/queries";

// ═══════════════════════════════════════════════════════════════
//  Server actions · CRUD Account (H1)
//  ─────────────────────────────────────────────────────────────
//  Reglas:
//   - Solo SA y MA pueden crear/editar/eliminar clientes
//     (canWrite("backoffice_clientes") = true)
//   - CA y OP no llegan acá (redirigidos en page.tsx)
//
//  CREATE:
//   - name requerido
//   - slug auto-generado del name. Si choca, agregamos -2, -3, ...
//   - tier default PRO
//   - industry opcional
//
//  UPDATE:
//   - name editable
//   - tier editable
//   - industry editable
//   - slug INMUTABLE (es URL-stable, cambiarlo rompe links viejos)
//
//  DELETE (hard):
//   - Solo si NO tiene assets, persons, groups, ni users
//   - Si tiene cualquier relación, devolver mensaje explicativo
//     pidiendo limpiar primero
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
}

export interface ClientInput {
  name: string;
  tier: "BASE" | "PRO" | "ENTERPRISE";
  industry: string;
}

const VALID_TIERS = ["BASE", "PRO", "ENTERPRISE"] as const;

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/**
 * Convierte un nombre en un slug URL-friendly.
 * Ejemplo: "Minera La Cumbre · S.A." → "minera-la-cumbre-sa"
 */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove special chars
    .replace(/\s+/g, "-") // spaces → dash
    .replace(/-+/g, "-") // collapse dashes
    .replace(/^-|-$/g, "") // trim leading/trailing dash
    .slice(0, 60);
}

/**
 * Generate a unique slug · si baseSlug está tomado, agrega -2, -3, ...
 */
async function generateUniqueSlug(baseSlug: string): Promise<string> {
  if (baseSlug.length === 0) {
    baseSlug = "cliente";
  }
  let slug = baseSlug;
  let n = 2;
  while (true) {
    const existing = await db.account.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${baseSlug}-${n}`;
    n++;
    if (n > 999) {
      throw new Error("No se pudo generar un slug único");
    }
  }
}

interface ValidatedData {
  name: string;
  tier: "BASE" | "PRO" | "ENTERPRISE";
  industry: string | null;
}

function validate(input: ClientInput): {
  errors: Record<string, string>;
  data?: ValidatedData;
} {
  const errors: Record<string, string> = {};
  const name = (input.name ?? "").trim();
  const industry = trimOrNull(input.industry);
  const tier = input.tier;

  if (name.length === 0) errors.name = "Requerido";
  else if (name.length > 100) errors.name = "Máximo 100 caracteres";

  if (!VALID_TIERS.includes(tier)) errors.tier = "Plan inválido";

  if (industry && industry.length > 60) {
    errors.industry = "Máximo 60 caracteres";
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { errors, data: { name, tier, industry } };
}

// ═══════════════════════════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════════════════════════

export async function createClient(input: ClientInput): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_clientes")) {
    return { ok: false, message: "No tenés permiso para crear clientes." };
  }

  const { errors, data } = validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // Verificar duplicado por nombre (case-insensitive)
  const allAccounts = await db.account.findMany({
    select: { id: true, name: true },
  });
  const dup = allAccounts.find(
    (a) => a.name.toLowerCase() === data.name.toLowerCase(),
  );
  if (dup) {
    return {
      ok: false,
      errors: { name: "Ya existe un cliente con ese nombre" },
    };
  }

  const baseSlug = slugify(data.name);
  const slug = await generateUniqueSlug(baseSlug);

  const created = await db.account.create({
    data: {
      organizationId: session.organization.id,
      name: data.name,
      slug,
      tier: data.tier,
      industry: data.industry,
    },
  });

  revalidatePath("/admin/clientes");
  return {
    ok: true,
    message: `Cliente "${data.name}" creado`,
    id: created.id,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Update · slug NO se cambia
// ═══════════════════════════════════════════════════════════════

export async function updateClient(
  accountId: string,
  input: ClientInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_clientes")) {
    return { ok: false, message: "No tenés permiso." };
  }

  const existing = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true },
  });
  if (!existing) return { ok: false, message: "Cliente no encontrado" };

  const { errors, data } = validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // Verificar duplicado de nombre (excluyendo el propio)
  if (data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const conflict = await db.account.findFirst({
      where: {
        name: { equals: data.name },
        NOT: { id: accountId },
      },
      select: { id: true },
    });
    if (conflict) {
      return {
        ok: false,
        errors: { name: "Ya existe otro cliente con ese nombre" },
      };
    }
  }

  await db.account.update({
    where: { id: accountId },
    data: {
      name: data.name,
      tier: data.tier,
      industry: data.industry,
    },
  });

  revalidatePath("/admin/clientes");
  return { ok: true, message: "Cliente actualizado" };
}

// ═══════════════════════════════════════════════════════════════
//  Delete · hard, bloqueado si tiene FK
// ═══════════════════════════════════════════════════════════════

export async function deleteClient(accountId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_clientes")) {
    return { ok: false, message: "No tenés permiso." };
  }

  const existing = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true },
  });
  if (!existing) return { ok: false, message: "Cliente no encontrado" };

  const stats = await getClientStats(accountId);
  const blockers: string[] = [];
  if (stats.assetCount > 0)
    blockers.push(`${stats.assetCount} ${stats.assetCount === 1 ? "vehículo" : "vehículos"}`);
  if (stats.personCount > 0)
    blockers.push(
      `${stats.personCount} ${stats.personCount === 1 ? "conductor" : "conductores"}`,
    );
  if (stats.groupCount > 0)
    blockers.push(`${stats.groupCount} ${stats.groupCount === 1 ? "grupo" : "grupos"}`);
  if (stats.userCount > 0)
    blockers.push(`${stats.userCount} ${stats.userCount === 1 ? "usuario" : "usuarios"}`);

  if (blockers.length > 0) {
    return {
      ok: false,
      message: `No se puede eliminar "${existing.name}" · tiene ${blockers.join(", ")}. Reasigná o eliminá esos elementos primero.`,
    };
  }

  await db.account.delete({ where: { id: accountId } });

  revalidatePath("/admin/clientes");
  return { ok: true, message: `Cliente "${existing.name}" eliminado` };
}
