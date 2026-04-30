"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/permissions";
import type { ImportResult } from "@/components/import-csv/types";

// ═══════════════════════════════════════════════════════════════
//  Bulk import de dispositivos · backoffice (H5a-2)
//  ─────────────────────────────────────────────────────────────
//  Permiso: canWrite("backoffice_dispositivos")
//
//  Decisiones de diseño:
//   · Todos los devices importados arrancan en status = STOCK,
//     sin asset asignado · porque al cargar un lote nuevo de
//     trackers desde el proveedor nunca están instalados aún.
//     El operador después los asigna desde el drawer existente.
//   · isPrimary = false siempre · sólo se marca cuando se asigna
//     a un asset.
//   · IMEI debe ser único · validamos contra DB y también dentro
//     del CSV (un mismo IMEI repetido en filas distintas).
// ═══════════════════════════════════════════════════════════════

export interface DeviceImportRow {
  rowNumber: number;
  imei: string;
  vendor: "TELTONIKA" | "QUECLINK" | "CONCOX" | "OTHER";
  model: string;
  serialNumber: string | null;
  firmwareVersion: string | null;
}

export async function importDevices(
  rows: DeviceImportRow[],
): Promise<ImportResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_dispositivos")) {
    return {
      ok: false,
      created: 0,
      skipped: rows.length,
      errors: [
        {
          rowNumber: 0,
          message: "No tenés permiso para importar dispositivos.",
        },
      ],
    };
  }

  // IMEIs ya existentes en DB (case-sensitive)
  const incomingImeis = rows.map((r) => r.imei);
  const existingDevices = await db.device.findMany({
    where: { imei: { in: incomingImeis } },
    select: { imei: true },
  });
  const existingImeiSet = new Set(existingDevices.map((d) => d.imei));

  // Detectar duplicados dentro del propio CSV
  const seenImeis = new Map<string, number>();

  const errors: ImportResult["errors"] = [];
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    if (existingImeiSet.has(row.imei)) {
      errors.push({
        rowNumber: row.rowNumber,
        column: "imei",
        message: `El IMEI "${row.imei}" ya existe en el sistema`,
      });
      skipped++;
      continue;
    }

    const prevRow = seenImeis.get(row.imei);
    if (prevRow !== undefined) {
      errors.push({
        rowNumber: row.rowNumber,
        column: "imei",
        message: `El IMEI "${row.imei}" aparece duplicado en el archivo (también en fila ${prevRow})`,
      });
      skipped++;
      continue;
    }
    seenImeis.set(row.imei, row.rowNumber);

    try {
      await db.device.create({
        data: {
          imei: row.imei,
          vendor: row.vendor,
          model: row.model,
          serialNumber: row.serialNumber,
          firmwareVersion: row.firmwareVersion,
          status: "STOCK",
          isPrimary: false,
          assetId: null,
        },
      });
      created++;
    } catch (err) {
      errors.push({
        rowNumber: row.rowNumber,
        message:
          err instanceof Error
            ? err.message
            : "Error inesperado al crear el dispositivo",
      });
      skipped++;
    }
  }

  if (created > 0) {
    revalidatePath("/admin/dispositivos");
  }

  return {
    ok: created > 0,
    created,
    skipped,
    errors,
    message:
      created === rows.length
        ? `Importación completada · ${created} dispositivos creados (en stock)`
        : created > 0
          ? `${created} creados · ${skipped} omitidos por errores`
          : `Ningún dispositivo se pudo importar`,
  };
}
