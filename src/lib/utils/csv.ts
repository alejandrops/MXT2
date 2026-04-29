// ═══════════════════════════════════════════════════════════════
//  CSV utility · un solo export point para toda la app
//  ─────────────────────────────────────────────────────────────
//  Reemplaza las 5 reimplementaciones que había en:
//    DistributionView · MultiMetricView · DriversDistributionView
//    DriversMultiMetricView · ScorecardClient
//
//  Convenciones del demo:
//    · Separador: ";" (Excel español lo entiende como CSV)
//    · Decimales: coma "," para que Excel-AR no rompa
//    · BOM UTF-8 al inicio para que Excel detecte tildes
//    · Filename con timestamp ISO sin guiones
// ═══════════════════════════════════════════════════════════════

const SEP = ";";
const BOM = "\uFEFF";

/**
 * Escape de un campo CSV.
 * Si contiene separador, comilla o salto de línea, encierra entre comillas
 * dobles y escapea las comillas internas duplicándolas.
 */
export function csvEsc(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Formato numérico AR para CSV · coma decimal · sin separador de miles.
 * Excel-AR procesa esto como número.
 */
export function csvNum(v: number, decimals = 1): string {
  if (!Number.isFinite(v)) return "";
  return v.toFixed(decimals).replace(".", ",");
}

interface DownloadOptions {
  /** Filename sin extensión · se agrega .csv */
  filename: string;
  /** Headers · primera fila */
  headers: string[];
  /** Filas · cada elemento es un array de strings (escapados o crudos) */
  rows: string[][];
  /** Si true, los rows se pasan por csvEsc() automáticamente. Default true. */
  autoEscape?: boolean;
}

/**
 * Genera el CSV y dispara la descarga en el navegador.
 * Idempotente · si lo llamás 2 veces se descarga 2 veces.
 */
export function downloadCsv(opts: DownloadOptions): void {
  const { filename, headers, rows, autoEscape = true } = opts;

  const escapeFn = autoEscape ? csvEsc : (s: string) => s;

  const lines: string[] = [];
  lines.push(headers.map(escapeFn).join(SEP));
  for (const row of rows) {
    lines.push(row.map(escapeFn).join(SEP));
  }

  const blob = new Blob([BOM + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper · genera filename estandarizado con timestamp.
 * stampType: "date" (YYYYMMDD) | "datetime" (YYYYMMDD-HHMM)
 */
export function csvFilename(
  baseName: string,
  stampType: "date" | "datetime" = "date",
): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  let stamp = `${y}${m}${d}`;
  if (stampType === "datetime") {
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    stamp += `-${hh}${mm}`;
  }
  return `${baseName}-${stamp}`;
}
