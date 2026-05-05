// ═══════════════════════════════════════════════════════════════
//  CSV export · cliente nativo, sin dependencias
//  ─────────────────────────────────────────────────────────────
//  Usado por el DataTable v2 cuando una tabla declara
//  exportFormats=['csv'] sin onExport custom. Convierte rows a
//  CSV y dispara descarga del browser.
//
//  Limitación · solo exporta las filas que recibe en memoria. Si
//  la tabla está paginada y hay más datos en server, esto exporta
//  solo la página visible. Para exportar TODO se necesita un
//  endpoint server-side · ver /api/export/xlsx para el patrón.
// ═══════════════════════════════════════════════════════════════

export interface CsvColumn<T> {
  /** Texto del header en el CSV */
  header: string;
  /** Función que extrae el valor de la fila como string/number */
  value: (row: T) => string | number | null | undefined;
}

/**
 * Escapa un valor según RFC 4180 · si contiene coma, comilla o
 * salto de línea, lo envuelve en comillas y dobla las comillas
 * internas.
 */
function escapeCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCell(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(","));
  }
  return lines.join("\r\n");
}

/**
 * Dispara la descarga del CSV en el browser.
 * BOM al inicio para que Excel lo abra como UTF-8.
 */
export function downloadCsv(filename: string, csv: string): void {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsToCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const csv = rowsToCsv(rows, columns);
  downloadCsv(filename, csv);
}
