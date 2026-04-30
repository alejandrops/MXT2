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
import {
  getGroupRelationCounts,
  getGroupDescendantIds,
} from "@/lib/queries/groups";

// ═══════════════════════════════════════════════════════════════
//  Server actions · CRUD Group
//  ─────────────────────────────────────────────────────────────
//  Particularidades vs A3/A4:
//    1. Jerarquía · validar que el padre no sea el mismo grupo
//       ni un descendiente (prevenir ciclo)
//    2. Padre debe pertenecer al mismo account
//    3. Hard delete · si tiene subgrupos hijos o vehículos
//       asignados, no se puede borrar
//
//  Cuando agreguemos `archivedAt` (post-MVP) reemplazamos hard
//  delete por update + filtro.
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
}

export interface GroupInput {
  /** Solo create */
  accountId?: string;
  name: string;
  parentId: string | null;
}

function validate(input: GroupInput, forCreate: boolean): {
  errors: Record<string, string>;
  data?: { name: string; parentId: string | null };
} {
  const errors: Record<string, string> = {};
  const name = (input.name ?? "").trim();
  const parentId = input.parentId === "" ? null : input.parentId ?? null;

  if (name.length === 0) errors.name = "Requerido";
  else if (name.length > 80) errors.name = "Máximo 80 caracteres";

  if (forCreate && !input.accountId) {
    errors.accountId = "Cliente requerido";
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { errors, data: { name, parentId } };
}

// ═══════════════════════════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════════════════════════

export async function createGroup(input: GroupInput): Promise<ActionResult> {
  const session = await getSession();
  if (!canCreateEntity(session, "catalogos", "grupos")) {
    return { ok: false, message: "No tenés permiso para crear grupos." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped)) {
    if (scoped.length === 0) return { ok: false, message: "Sin permiso." };
    if (!input.accountId || !scoped.includes(input.accountId)) {
      input.accountId = scoped[0];
    }
  }

  const { errors, data } = validate(input, true);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // Validar accountId existe
  const account = await db.account.findUnique({
    where: { id: input.accountId! },
    select: { id: true },
  });
  if (!account) return { ok: false, errors: { accountId: "Cliente inválido" } };

  // Validar parent (si viene) pertenece al mismo account
  if (data.parentId) {
    const parent = await db.group.findUnique({
      where: { id: data.parentId },
      select: { accountId: true },
    });
    if (!parent || parent.accountId !== input.accountId) {
      return { ok: false, errors: { parentId: "Grupo padre inválido" } };
    }
  }

  const created = await db.group.create({
    data: {
      accountId: input.accountId!,
      name: data.name,
      parentId: data.parentId,
    },
  });

  revalidatePath("/catalogos/grupos");
  return { ok: true, message: "Grupo creado", id: created.id };
}

// ═══════════════════════════════════════════════════════════════
//  Update
// ═══════════════════════════════════════════════════════════════

export async function updateGroup(
  groupId: string,
  input: GroupInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canUpdateEntity(session, "catalogos", "grupos")) {
    return { ok: false, message: "No tenés permiso." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }

  const existing = await db.group.findUnique({
    where: { id: groupId },
    select: { id: true, accountId: true },
  });
  if (!existing) return { ok: false, message: "Grupo no encontrado" };
  if (Array.isArray(scoped) && !scoped.includes(existing.accountId)) {
    return { ok: false, message: "Sin permiso para este grupo." };
  }

  input.accountId = existing.accountId;

  const { errors, data } = validate(input, false);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // Validar parent
  if (data.parentId) {
    // No puede ser el mismo grupo
    if (data.parentId === groupId) {
      return {
        ok: false,
        errors: { parentId: "Un grupo no puede ser su propio padre" },
      };
    }
    // Padre debe pertenecer al mismo account
    const parent = await db.group.findUnique({
      where: { id: data.parentId },
      select: { accountId: true },
    });
    if (!parent || parent.accountId !== existing.accountId) {
      return { ok: false, errors: { parentId: "Grupo padre inválido" } };
    }
    // Padre no puede ser un descendiente (evitar ciclo)
    const descendants = await getGroupDescendantIds(groupId);
    if (descendants.includes(data.parentId)) {
      return {
        ok: false,
        errors: {
          parentId: "El grupo padre no puede ser un subgrupo del actual",
        },
      };
    }
  }

  await db.group.update({
    where: { id: groupId },
    data: { name: data.name, parentId: data.parentId },
  });

  revalidatePath("/catalogos/grupos");
  return { ok: true, message: "Grupo actualizado" };
}

// ═══════════════════════════════════════════════════════════════
//  Delete · solo si no tiene hijos directos ni vehículos
// ═══════════════════════════════════════════════════════════════

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!canDeleteEntity(session, "catalogos", "grupos")) {
    return { ok: false, message: "No tenés permiso." };
  }

  const scoped = getScopedAccountIds(session, "catalogos");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }

  const existing = await db.group.findUnique({
    where: { id: groupId },
    select: { accountId: true, name: true },
  });
  if (!existing) return { ok: false, message: "Grupo no encontrado" };
  if (Array.isArray(scoped) && !scoped.includes(existing.accountId)) {
    return { ok: false, message: "Sin permiso para este grupo." };
  }

  const counts = await getGroupRelationCounts(groupId);
  if (counts.total > 0) {
    const parts: string[] = [];
    if (counts.childGroups > 0)
      parts.push(
        `${counts.childGroups} ${counts.childGroups === 1 ? "subgrupo" : "subgrupos"}`,
      );
    if (counts.vehicles > 0)
      parts.push(
        `${counts.vehicles} ${counts.vehicles === 1 ? "vehículo asignado" : "vehículos asignados"}`,
      );
    return {
      ok: false,
      message: `No se puede eliminar el grupo "${existing.name}" · tiene ${parts.join(" y ")}. Reasigná primero.`,
    };
  }

  await db.group.delete({ where: { id: groupId } });
  revalidatePath("/catalogos/grupos");
  return { ok: true, message: "Grupo eliminado" };
}
