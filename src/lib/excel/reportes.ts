// ═══════════════════════════════════════════════════════════════
//  Excel export · Reportes · L10
//  ─────────────────────────────────────────────────────────────
//  Generador genérico · recibe rows + columns y arma una sheet.
//
//  Reportes tiene 5 vistas · cada una llama a este generador
//  con su propia config. La diferencia entre vistas es solo la
//  estructura de columnas, no el flujo de generación.
//
//  Vistas que llaman al generador:
//   · DistributionView          · vehicles × time
//   · MultiMetricView           · vehicles × metrics
//   · DriversDistributionView   · drivers × time
//   · DriversMultiMetricView    · drivers × metrics
//   · VisualView                · widgets visualizables
//
//  Si el formato es complejo (ej. matriz dinámica), el caller
//  pre-procesa los rows.
// ═══════════════════════════════════════════════════════════════

import {
  addFooter,
  createWorkbook,
  DECIMAL1_FMT,
  INT_FMT,
  setColumnWidths,
  styleHeaderRow,
  workbookToBuffer,
} from "./shared";

export type CellValue = string | number | boolean | Date | null | undefined;

export interface ColumnDef {
  header: string;
  width?: number;
  /** "int" · "decimal1" · "text" · "date" */
  format?: "int" | "decimal1" | "text" | "date";
}

export interface ReportesExportOptions {
  /** Nombre de la hoja · ej "Vehículos · 30 días" */
  sheetName: string;
  /** Subject del workbook · ej "Reporte vehículos · marzo 2026" */
  subject: string;
  columns: ColumnDef[];
  rows: CellValue[][];
}

export async function generateReportesXlsx(
  options: ReportesExportOptions,
): Promise<Buffer> {
  const wb = await createWorkbook();
  wb.subject = options.subject;

  const sheet = wb.addWorksheet(safeSheetName(options.sheetName));

  // Header row
  sheet.addRow(options.columns.map((c) => c.header));
  styleHeaderRow(sheet, 1);

  // Column widths
  const widths = options.columns.map((c) => c.width ?? 14);
  setColumnWidths(sheet, widths);

  // Data rows
  for (const row of options.rows) {
    sheet.addRow(row);
  }

  // Format por columna
  options.columns.forEach((col, idx) => {
    const colNumber = idx + 1;
    switch (col.format) {
      case "int":
        sheet.getColumn(colNumber).numFmt = INT_FMT;
        break;
      case "decimal1":
        sheet.getColumn(colNumber).numFmt = DECIMAL1_FMT;
        break;
      case "date":
        sheet.getColumn(colNumber).numFmt = "dd/mm/yyyy";
        break;
      // "text" · sin format
    }
  });

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  addFooter(sheet);

  return workbookToBuffer(wb);
}

/** Excel limita nombres de hoja a 31 chars y prohíbe : \ / ? * [ ] */
function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*\[\]]/g, " ").substring(0, 31).trim() || "Hoja 1";
}
