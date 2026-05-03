// ═══════════════════════════════════════════════════════════════
//  Excel export · shared helpers · L10
//  ─────────────────────────────────────────────────────────────
//  Helpers de bajo nivel para generar XLSX con exceljs.
//  Se importan desde los 3 generadores (trips, reportes, boletin)
//  · NO se importan desde código de UI.
//
//  El Route Handler /api/export/xlsx hace dynamic import de los
//  generadores (no estos helpers) para mantener exceljs fuera
//  del bundle de pages.
// ═══════════════════════════════════════════════════════════════

import type { Workbook, Worksheet, Style } from "exceljs";

/** Estilos base · header de tabla */
export const HEADER_STYLE: Partial<Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
  fill: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" }, // accBlu
  },
  alignment: { vertical: "middle", horizontal: "left" },
  border: {
    bottom: { style: "thin", color: { argb: "FF1E40AF" } },
  },
};

/** Estilo de KPI title */
export const KPI_TITLE_STYLE: Partial<Style> = {
  font: { bold: true, size: 14, color: { argb: "FF111827" } },
  alignment: { vertical: "middle", horizontal: "left" },
};

/** Estilo de KPI label */
export const KPI_LABEL_STYLE: Partial<Style> = {
  font: { size: 9, color: { argb: "FF6B7280" }, bold: true },
  alignment: { horizontal: "left" },
};

/** Estilo de KPI value */
export const KPI_VALUE_STYLE: Partial<Style> = {
  font: { size: 14, bold: true, color: { argb: "FF111827" } },
  alignment: { horizontal: "left" },
};

/** Estilo de section title (separador entre bloques) */
export const SECTION_TITLE_STYLE: Partial<Style> = {
  font: { bold: true, size: 12, color: { argb: "FF111827" } },
  alignment: { vertical: "middle" },
};

/** Aplica HEADER_STYLE a una fila completa de la sheet */
export function styleHeaderRow(sheet: Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  row.height = 22;
  row.eachCell((cell: import("exceljs").Cell) => {
    Object.assign(cell, HEADER_STYLE);
  });
  row.commit();
}

/** Setea anchos de columnas · array paralelo a los headers */
export function setColumnWidths(sheet: Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

/** Auto-fit columns · estima ancho a partir del contenido máximo */
export function autoFitColumns(sheet: Worksheet, padding = 2, max = 40) {
  sheet.columns.forEach((col: import("exceljs").Column | undefined) => {
    if (!col) return;
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell: import("exceljs").Cell) => {
      const v = cell.value;
      const len = v == null ? 0 : String(v).length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + padding, max);
  });
}

/** Formato de fecha estándar (dd/mm/yyyy) */
export const DATE_FMT = "dd/mm/yyyy";

/** Formato de fecha + hora */
export const DATETIME_FMT = "dd/mm/yyyy hh:mm";

/** Formato de número entero con separador de miles */
export const INT_FMT = "#,##0";

/** Formato de número con 1 decimal */
export const DECIMAL1_FMT = "#,##0.0";

/** Formato de porcentaje */
export const PCT_FMT = "0.0%";

/** Convierte un Date a string DD/MM/YYYY (timezone offset Argentina UTC-3) */
export function dateLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const local = new Date(d.getTime() - 3 * 60 * 60_000);
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = local.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Footer estándar de cada hoja · "Generado por Maxtracker · {fecha}" */
export function addFooter(sheet: Worksheet, generatedAt: Date = new Date()) {
  const ts = `${dateLocal(generatedAt)} ${String(
    generatedAt.getUTCHours() - 3,
  ).padStart(2, "0")}:${String(generatedAt.getUTCMinutes()).padStart(2, "0")}`;
  sheet.headerFooter = {
    oddFooter: `&L&8Maxtracker · Reporte generado &C${sheet.name}&R&8${ts}`,
  };
}

/** Crea workbook con metadata estándar */
export async function createWorkbook(): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Maxtracker";
  wb.lastModifiedBy = "Maxtracker";
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}

/** Genera el buffer final · listo para enviar como Response */
export async function workbookToBuffer(wb: Workbook): Promise<Buffer> {
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
