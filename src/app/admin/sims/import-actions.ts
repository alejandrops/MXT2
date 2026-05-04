// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";
import type { ImportResult } from "@/components/import-csv/types";

// ═══════════════════════════════════════════════════════════════
//  Bulk import de SIMs · backoffice (H5a-2)
//  ─────────────────────────────────────────────────────────────
//  Permiso: canWrite("backoffice_sims")
//
//  Decisiones de diseño:
//   · Todas las SIMs importadas arrancan en status = STOCK,
//     sin device asignado · porque al cargar un lote nuevo de
//     SIMs del carrier nunca están operando aún. El operador
//     después las asigna a un device desde el drawer existente.
//   · ICCID debe ser único · validamos contra DB y dentro del
//     CSV.
//   · APN es required · sin APN la SIM no puede conectarse.
// ═══════════════════════════════════════════════════════════════

export interface SimImportRow {
  rowNumber: number;
  iccid: string;
  carrier: "MOVISTAR" | "CLARO" | "PERSONAL" | "ENTEL" | "OTHER";
  apn: string;
  phoneNumber: string | null;
  imsi: string | null;
  dataPlanMb: number;
}

export async function importSims(
  rows: SimImportRow[],
): Promise<ImportResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_sims")) {
    return {
      ok: false,
      created: 0,
      skipped: rows.length,
      errors: [
        {
          rowNumber: 0,
          message: "No tenés permiso para importar SIMs.",
        },
      ],
    };
  }

  // ICCIDs ya existentes en DB
  const incomingIccids = rows.map((r) => r.iccid);
  const existingSims = await db.sim.findMany({
    where: { iccid: { in: incomingIccids } },
    select: { iccid: true },
  });
  const existingIccidSet = new Set(existingSims.map((s) => s.iccid));

  // Detectar duplicados dentro del propio CSV
  const seenIccids = new Map<string, number>();

  const errors: ImportResult["errors"] = [];
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    if (existingIccidSet.has(row.iccid)) {
      errors.push({
        rowNumber: row.rowNumber,
        column: "iccid",
        message: `El ICCID "${row.iccid}" ya existe en el sistema`,
      });
      skipped++;
      continue;
    }

    const prevRow = seenIccids.get(row.iccid);
    if (prevRow !== undefined) {
      errors.push({
        rowNumber: row.rowNumber,
        column: "iccid",
        message: `El ICCID "${row.iccid}" aparece duplicado en el archivo (también en fila ${prevRow})`,
      });
      skipped++;
      continue;
    }
    seenIccids.set(row.iccid, row.rowNumber);

    try {
      await db.sim.create({
        data: {
          iccid: row.iccid,
          carrier: row.carrier,
          apn: row.apn,
          phoneNumber: row.phoneNumber,
          imsi: row.imsi,
          dataPlanMb: row.dataPlanMb,
          status: "STOCK",
        },
      });
      created++;
    } catch (err) {
      errors.push({
        rowNumber: row.rowNumber,
        message:
          err instanceof Error
            ? err.message
            : "Error inesperado al crear la SIM",
      });
      skipped++;
    }
  }

  if (created > 0) {
    revalidatePath("/admin/sims");
  }

  return {
    ok: created > 0,
    created,
    skipped,
    errors,
    message:
      created === rows.length
        ? `Importación completada · ${created} SIMs creadas (en stock)`
        : created > 0
          ? `${created} creadas · ${skipped} omitidas por errores`
          : `Ninguna SIM se pudo importar`,
  };
}
