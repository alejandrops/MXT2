// ═══════════════════════════════════════════════════════════════
//  Excel export · cliente · L10
//  ─────────────────────────────────────────────────────────────
//  Helper que llama al Route Handler y dispara la descarga en
//  el browser. No incluye exceljs · solo fetch + Blob.
//
//  Uso típico:
//    onExportXlsx={() => exportTripsXlsx(currentParams)}
// ═══════════════════════════════════════════════════════════════

interface TripsExportParams {
  fromDate: string;
  toDate: string;
  assetIds: string[];
  groupIds: string[];
  personIds: string[];
}

export async function exportTripsXlsx(params: TripsExportParams): Promise<void> {
  const res = await fetch("/api/export/xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "trips", params }),
  });
  if (!res.ok) {
    throw new Error(`Export failed · status ${res.status}`);
  }
  const blob = await res.blob();
  const filename =
    parseFilename(res.headers.get("Content-Disposition")) ??
    `viajes_${params.fromDate}_${params.toDate}.xlsx`;
  triggerDownload(blob, filename);
}

interface ReportesGenericExportArgs {
  subject: string;
  sheetName: string;
  columns: { header: string; width?: number; format?: "int" | "decimal1" | "text" | "date" }[];
  rows: (string | number | boolean | null)[][];
}

export async function exportReportesXlsx(
  args: ReportesGenericExportArgs,
): Promise<void> {
  const res = await fetch("/api/export/xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "reportes-generic", ...args }),
  });
  if (!res.ok) {
    throw new Error(`Export failed · status ${res.status}`);
  }
  const blob = await res.blob();
  const safeName = args.sheetName.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
  const filename =
    parseFilename(res.headers.get("Content-Disposition")) ??
    `${safeName || "reporte"}.xlsx`;
  triggerDownload(blob, filename);
}

// ── Helpers ──────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberar URL después de un tick
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] ?? null;
}
