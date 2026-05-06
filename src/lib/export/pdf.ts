// ═══════════════════════════════════════════════════════════════
//  PDF export · S5-T3-fix2
//  ─────────────────────────────────────────────────────────────
//  Carga jsPDF + jspdf-autotable desde CDN on-demand. NO agrega
//  deps al package.json. Se cargan ambos scripts · jsPDF primero
//  y luego autotable como plugin.
//
//  Mismo patrón que xlsx.ts. Si el CDN está bloqueado el export
//  falla con error claro · el caller puede fallback a CSV.
// ═══════════════════════════════════════════════════════════════

import type { CsvColumn } from "./csv";

const JSPDF_CDN =
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
const AUTOTABLE_CDN =
  "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js";

interface JsPDFInstance {
  text: (text: string, x: number, y: number, opts?: object) => void;
  setFontSize: (size: number) => void;
  setTextColor: (...args: number[]) => void;
  setFont: (font: string, style?: string) => void;
  internal: {
    pageSize: { width: number; height: number };
    getNumberOfPages: () => number;
  };
  setPage: (n: number) => void;
  save: (filename: string) => void;
  autoTable: (opts: object) => void;
}

interface JsPDFConstructor {
  new (opts?: { orientation?: "p" | "l"; unit?: string; format?: string }): JsPDFInstance;
}

interface JsPDFGlobal {
  jsPDF: JsPDFConstructor;
}

declare global {
  interface Window {
    jspdf?: JsPDFGlobal;
  }
}

let loadingPromise: Promise<JsPDFConstructor> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });
}

async function loadJsPDF(): Promise<JsPDFConstructor> {
  if (typeof window === "undefined") {
    throw new Error("PDF export solo funciona en el browser");
  }
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await loadScript(JSPDF_CDN);
    await loadScript(AUTOTABLE_CDN);
    if (!window.jspdf?.jsPDF) {
      loadingPromise = null;
      throw new Error("jsPDF no se cargó correctamente desde el CDN");
    }
    return window.jspdf.jsPDF;
  })();

  return loadingPromise;
}

/**
 * Exporta rows como PDF en formato horizontal con tabla.
 * Header con título + subtítulo + fecha generación. Footer con paginación.
 */
export async function exportRowsToPdf<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
  options?: {
    title?: string;
    subtitle?: string;
  },
): Promise<void> {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "l", unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.width;
  const title = options?.title ?? filename.replace(/-/g, " ");
  const subtitle = options?.subtitle;
  const generated = new Date().toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Header · título principal
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(title, 40, 40);

  // Subtítulo (si hay)
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 40, 55);
  }

  // Fecha generación · derecha
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generado · ${generated} ART`,
    pageW - 40,
    40,
    { align: "right" },
  );
  doc.text(
    `${rows.length.toLocaleString("es-AR")} registros`,
    pageW - 40,
    54,
    { align: "right" },
  );

  // Tabla
  const head = [columns.map((c) => c.header)];
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row);
      if (v === null || v === undefined) return "";
      return String(v);
    }),
  );

  const tableStartY = subtitle ? 75 : 70;

  doc.autoTable({
    head,
    body,
    startY: tableStartY,
    margin: { left: 40, right: 40 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      lineColor: [240, 240, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [250, 250, 250],
      textColor: [107, 114, 128],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    theme: "plain",
  });

  // Footer · paginación
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageW / 2,
      doc.internal.pageSize.height - 20,
      { align: "center" },
    );
  }

  const fname = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(fname);
}
