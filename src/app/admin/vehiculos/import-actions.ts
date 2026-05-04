// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";
import type { ImportResult } from "@/components/import-csv/types";

// ═══════════════════════════════════════════════════════════════
//  Bulk import de vehículos · backoffice (H7c-2)
//  ─────────────────────────────────────────────────────────────
//  Movido del lote H5a-1 (donde estaba mal escopado en /catalogos)
//  a /admin/vehiculos. Acá es cross-cliente · Maxtracker staff
//  importa flotas de cualquier cliente.
//
//  Permiso: canWrite("backoffice_vehiculos")
//  Sin scope · puede crear assets para cualquier slug existente
// ═══════════════════════════════════════════════════════════════

export interface VehicleImportRow {
  rowNumber: number;
  name: string;
  accountSlug: string;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicleType: string;
  mobilityType: string;
  initialOdometerKm: number | null;
}

export async function importVehicles(
  rows: VehicleImportRow[],
): Promise<ImportResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_vehiculos")) {
    return {
      ok: false,
      created: 0,
      skipped: rows.length,
      errors: [
        {
          rowNumber: 0,
          message: "No tenés permiso para importar vehículos.",
        },
      ],
    };
  }

  // Cargamos los accounts que vamos a necesitar · clave por slug
  // para resolver rápido. Backoffice ve todos.
  const allAccountSlugs = Array.from(
    new Set(rows.map((r) => r.accountSlug.toLowerCase())),
  );
  const accountsWhere: any = { slug: { in: allAccountSlugs } };
  const accounts = await db.account.findMany({
    where: accountsWhere,
    select: { id: true, slug: true },
  });
  const accountBySlug = new Map(
    accounts.map((a) => [a.slug.toLowerCase(), a.id]),
  );

  // Patentes existentes (case-insensitive) · cache para evitar
  // hits repetidos a DB
  const existingPlates = await db.asset.findMany({
    where: {
      plate: {
        in: rows
          .map((r) => r.plate?.toUpperCase())
          .filter((p): p is string => !!p),
      },
    },
    select: { plate: true },
  });
  const plateSet = new Set(
    existingPlates.map((a) => a.plate?.toUpperCase()).filter(Boolean),
  );

  // Conjunto de patentes vistas dentro del mismo CSV (para detectar
  // duplicados en el mismo archivo)
  const seenPlatesInCsv = new Set<string>();

  const errors: ImportResult["errors"] = [];
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    // Validar account
    const accountId = accountBySlug.get(row.accountSlug.toLowerCase());
    if (!accountId) {
      errors.push({
        rowNumber: row.rowNumber,
        column: "cliente",
        message: `Cliente "${row.accountSlug}" no encontrado o verificá el slug en /admin/clientes`,
      });
      skipped++;
      continue;
    }

    // Validar patente única
    const plateUpper = row.plate?.toUpperCase() ?? null;
    if (plateUpper) {
      if (plateSet.has(plateUpper)) {
        errors.push({
          rowNumber: row.rowNumber,
          column: "patente",
          message: `La patente "${plateUpper}" ya existe en el sistema`,
        });
        skipped++;
        continue;
      }
      if (seenPlatesInCsv.has(plateUpper)) {
        errors.push({
          rowNumber: row.rowNumber,
          column: "patente",
          message: `La patente "${plateUpper}" aparece más de una vez en el archivo`,
        });
        skipped++;
        continue;
      }
      seenPlatesInCsv.add(plateUpper);
    }

    try {
      await db.asset.create({
        data: {
          accountId,
          name: row.name,
          plate: plateUpper,
          vin: row.vin?.toUpperCase() ?? null,
          make: row.make,
          model: row.model,
          year: row.year,
          initialOdometerKm: row.initialOdometerKm,
          vehicleType: row.vehicleType as any,
          mobilityType: row.mobilityType as any,
          status: "IDLE",
        },
      });
      created++;
    } catch (err) {
      errors.push({
        rowNumber: row.rowNumber,
        message:
          err instanceof Error
            ? err.message
            : "Error inesperado al crear el vehículo",
      });
      skipped++;
    }
  }

  if (created > 0) {
    revalidatePath("/admin/vehiculos");
    revalidatePath("/catalogos/vehiculos");
  }

  return {
    ok: created > 0,
    created,
    skipped,
    errors,
    message:
      created === rows.length
        ? `Importación completada · ${created} vehículos creados`
        : created > 0
          ? `${created} creados · ${skipped} omitidos por errores`
          : `Ningún vehículo se pudo importar`,
  };
}
