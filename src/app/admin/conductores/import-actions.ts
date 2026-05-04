// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";
import type { ImportResult } from "@/components/import-csv/types";

// ═══════════════════════════════════════════════════════════════
//  Bulk import de conductores · backoffice (H7d)
//  ─────────────────────────────────────────────────────────────
//  Permiso: canWrite("backoffice_conductores")
//  Sin scope · puede crear conductores para cualquier cliente.
// ═══════════════════════════════════════════════════════════════

export interface DriverImportRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  accountSlug: string;
  document: string | null;
  /** ISO date (YYYY-MM-DD) o null */
  licenseExpiresAt: string | null;
  /** ISO date (YYYY-MM-DD) o null */
  hiredAt: string | null;
}

export async function importDrivers(
  rows: DriverImportRow[],
): Promise<ImportResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_conductores")) {
    return {
      ok: false,
      created: 0,
      skipped: rows.length,
      errors: [
        {
          rowNumber: 0,
          message: "No tenés permiso para importar conductores.",
        },
      ],
    };
  }

  // Resolver slugs
  const allSlugs = Array.from(
    new Set(rows.map((r) => r.accountSlug.toLowerCase())),
  );
  const accounts = await db.account.findMany({
    where: { slug: { in: allSlugs } },
    select: { id: true, slug: true },
  });
  const accountBySlug = new Map(
    accounts.map((a) => [a.slug.toLowerCase(), a.id]),
  );

  // Detectar duplicados de documento dentro del CSV (warning,
  // permitimos pero alertamos). En la DB no hay constraint único
  // global porque distintos clientes pueden tener mismos números.
  const docSeenInCsv = new Map<string, number>(); // doc → rowNumber

  const errors: ImportResult["errors"] = [];
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const accountId = accountBySlug.get(row.accountSlug.toLowerCase());
    if (!accountId) {
      errors.push({
        rowNumber: row.rowNumber,
        column: "cliente",
        message: `Cliente "${row.accountSlug}" no encontrado · verificá el slug en /admin/clientes`,
      });
      skipped++;
      continue;
    }

    if (row.document) {
      const docKey = `${accountId}:${row.document}`;
      const prevRow = docSeenInCsv.get(docKey);
      if (prevRow !== undefined) {
        errors.push({
          rowNumber: row.rowNumber,
          column: "documento",
          message: `El documento "${row.document}" aparece duplicado en el archivo (también en fila ${prevRow})`,
        });
        skipped++;
        continue;
      }
      docSeenInCsv.set(docKey, row.rowNumber);
    }

    let licenseExpiresAt: Date | null = null;
    if (row.licenseExpiresAt) {
      const d = new Date(row.licenseExpiresAt + "T00:00:00.000Z");
      if (Number.isNaN(d.getTime())) {
        errors.push({
          rowNumber: row.rowNumber,
          column: "licencia_vence",
          message: "Fecha de licencia inválida (formato YYYY-MM-DD)",
        });
        skipped++;
        continue;
      }
      licenseExpiresAt = d;
    }
    let hiredAt: Date | null = null;
    if (row.hiredAt) {
      const d = new Date(row.hiredAt + "T00:00:00.000Z");
      if (Number.isNaN(d.getTime())) {
        errors.push({
          rowNumber: row.rowNumber,
          column: "fecha_contrato",
          message: "Fecha de contrato inválida (formato YYYY-MM-DD)",
        });
        skipped++;
        continue;
      }
      hiredAt = d;
    }

    try {
      await db.person.create({
        data: {
          accountId,
          firstName: row.firstName,
          lastName: row.lastName,
          document: row.document,
          licenseExpiresAt,
          hiredAt,
          // safetyScore default = 75
        },
      });
      created++;
    } catch (err) {
      errors.push({
        rowNumber: row.rowNumber,
        message:
          err instanceof Error
            ? err.message
            : "Error inesperado al crear el conductor",
      });
      skipped++;
    }
  }

  if (created > 0) {
    revalidatePath("/admin/conductores");
    revalidatePath("/catalogos/conductores");
  }

  return {
    ok: created > 0,
    created,
    skipped,
    errors,
    message:
      created === rows.length
        ? `Importación completada · ${created} conductores creados`
        : created > 0
          ? `${created} creados · ${skipped} omitidos por errores`
          : `Ningún conductor se pudo importar`,
  };
}
