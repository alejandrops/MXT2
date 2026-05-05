// ═══════════════════════════════════════════════════════════════
//  XLSX export · S5-T3
//  ─────────────────────────────────────────────────────────────
//  Carga SheetJS desde CDN on-demand. NO agrega dependencia al
//  package.json · solo se carga cuando el usuario clickea
//  "Exportar Excel" la primera vez. Se cachea en window.XLSX.
//
//  CDN · jsdelivr · 0.18.5 (versión estable a may 2026).
//  Si el CDN está bloqueado (CSP, offline, etc.), el export
//  falla con error claro · el usuario puede caer al CSV.
// ═══════════════════════════════════════════════════════════════

import type { CsvColumn } from "./csv";

const SHEETJS_CDN =
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

interface SheetJSGlobal {
  utils: {
    aoa_to_sheet: (data: unknown[][]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (book: unknown, sheet: unknown, name: string) => void;
  };
  writeFile: (book: unknown, filename: string) => void;
}

declare global {
  interface Window {
    XLSX?: SheetJSGlobal;
  }
}

let loadingPromise: Promise<SheetJSGlobal> | null = null;

async function loadSheetJS(): Promise<SheetJSGlobal> {
  if (typeof window === "undefined") {
    throw new Error("XLSX export solo funciona en el browser");
  }
  if (window.XLSX) return window.XLSX;
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise<SheetJSGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SHEETJS_CDN;
    script.async = true;
    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX);
      } else {
        reject(new Error("SheetJS no se cargó correctamente desde el CDN"));
      }
    };
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error("No se pudo cargar SheetJS desde el CDN"));
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}

/**
 * Exporta rows como Excel · usa SheetJS dinámico.
 * Lanza error si el CDN está bloqueado · el caller puede mostrar
 * mensaje y sugerir CSV.
 */
export async function exportRowsToXlsx<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): Promise<void> {
  const XLSX = await loadSheetJS();

  // Construir array of arrays · header + filas
  const headers = columns.map((c) => c.header);
  const dataRows = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row);
      // SheetJS prefiere null para celdas vacías
      if (v === null || v === undefined) return null;
      return v;
    }),
  );
  const aoa = [headers, ...dataRows];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Datos");

  const fname = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(book, fname);
}
