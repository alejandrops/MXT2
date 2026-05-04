"use client";

import { useState, useRef, useEffect } from "react";
import {
  Download,
  ChevronDown,
  FileText,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import type { AnalysisGranularity } from "@/lib/queries";
import styles from "./ExportMenu.module.css";

// ═══════════════════════════════════════════════════════════════
//  ExportMenu · L10 · CSV + Excel + Imprimir
//  ─────────────────────────────────────────────────────────────
//  Reemplaza:
//    · botones "Exportar CSV" individuales en cada View
//    · botón "Imprimible mensual" hardcodeado
//    · PrintMenu standalone
//
//  Comportamiento (post-L10):
//    · si solo se pasa onExportCsv · botón directo "Exportar CSV"
//    · si solo se pasa onExportXlsx · botón directo "Exportar Excel"
//    · si solo se pasa printPeriod · botón directo "Imprimir"
//    · 2 o más opciones · dropdown "Exportar ▾"
//
//  Imprimir abre el imprimible HTML en pestaña nueva. Excel
//  triggea download via fetch + Blob.
// ═══════════════════════════════════════════════════════════════

export type PrintPeriodKey = "semanal" | "mensual" | "anual";

const DEFAULT_PRINT_BASE = "/actividad/reportes/imprimible";

interface Props {
  /** Handler para exportar CSV · si null, no aparece la opción */
  onExportCsv?: (() => void) | null;
  /** Handler para exportar Excel · si null, no aparece la opción */
  onExportXlsx?: (() => void) | null;
  /** Período del imprimible · si null, no aparece la opción.
   *  Abre el imprimible HTML del módulo en una pestaña nueva. */
  printPeriod?: PrintPeriodKey | null;
  /** Override del path base del imprimible */
  printBasePath?: string;
  /**
   * Handler de impresión arbitrario · si se pasa, agrega la
   * opción "Imprimir / PDF" que ejecuta este callback en lugar
   * de abrir un imprimible HTML separado.
   *
   * Caso de uso típico: el documento actual ya es la versión
   * imprimible (Boletín, Libro del Objeto), entonces el callback
   * llama a `window.print()` directamente.
   *
   * Excluyente con `printPeriod` · solo uno de los dos modos
   * de impresión tiene sentido por instancia.
   */
  onPrintDocument?: (() => void) | null;
}

export function ExportMenu({
  onExportCsv,
  onExportXlsx,
  printPeriod,
  printBasePath = DEFAULT_PRINT_BASE,
  onPrintDocument,
}: Props) {
  const hasCsv = !!onExportCsv;
  const hasXlsx = !!onExportXlsx;
  const hasPrintHref = printPeriod != null;
  const hasPrintDoc = !!onPrintDocument;
  const hasPrint = hasPrintHref || hasPrintDoc;

  // Nada que mostrar
  if (!hasCsv && !hasXlsx && !hasPrint) return null;

  function handlePrint() {
    if (hasPrintDoc) {
      onPrintDocument?.();
      return;
    }
    if (!printPeriod) return;
    const href = buildPrintHref(printBasePath, printPeriod);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  // 1 sola opción · botón directo
  const optionsCount = (hasCsv ? 1 : 0) + (hasXlsx ? 1 : 0) + (hasPrint ? 1 : 0);

  if (optionsCount === 1) {
    if (hasCsv) {
      return (
        <button
          type="button"
          className={styles.button}
          onClick={onExportCsv}
          title="Exportar a CSV"
        >
          <Download size={13} />
          <span>Exportar CSV</span>
        </button>
      );
    }
    if (hasXlsx) {
      return (
        <button
          type="button"
          className={styles.button}
          onClick={onExportXlsx}
          title="Exportar a Excel"
        >
          <FileSpreadsheet size={13} />
          <span>Exportar Excel</span>
        </button>
      );
    }
    if (hasPrint) {
      return (
        <button
          type="button"
          className={styles.button}
          onClick={handlePrint}
          title="Imprimir o guardar como PDF"
        >
          <Printer size={13} />
          <span>Imprimir</span>
        </button>
      );
    }
  }

  // 2+ opciones · dropdown
  return (
    <Dropdown
      onCsv={hasCsv ? onExportCsv : null}
      onXlsx={hasXlsx ? onExportXlsx : null}
      onPrint={hasPrint ? handlePrint : null}
    />
  );
}

// ── Dropdown ──────────────────────────────────────────────────

function Dropdown({
  onCsv,
  onXlsx,
  onPrint,
}: {
  onCsv: (() => void) | null | undefined;
  onXlsx: (() => void) | null | undefined;
  onPrint: (() => void) | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function handleCsv() {
    onCsv?.();
    setOpen(false);
  }
  function handleXlsx() {
    onXlsx?.();
    setOpen(false);
  }
  function handlePrint() {
    onPrint?.();
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={13} />
        <span>Exportar</span>
        <ChevronDown
          size={12}
          className={`${styles.chev} ${open ? styles.chevOpen : ""}`}
        />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {onCsv && (
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={handleCsv}
            >
              <FileText size={13} className={styles.menuIcon} />
              <span>CSV</span>
            </button>
          )}
          {onXlsx && (
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={handleXlsx}
            >
              <FileSpreadsheet size={13} className={styles.menuIcon} />
              <span>Excel (.xlsx)</span>
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={handlePrint}
            >
              <Printer size={13} className={styles.menuIcon} />
              <span>Imprimir / PDF</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Mapeo granularidad de pantalla → período de imprimible.
 * Si la granularidad no tiene imprimible, retorna null.
 */
export function granularityToPeriod(
  g: AnalysisGranularity,
): PrintPeriodKey | null {
  switch (g) {
    case "week-days":
      return "semanal";
    case "month-days":
      return "mensual";
    case "year-weeks":
    case "year-months":
      return "anual";
    case "day-hours":
    default:
      return null;
  }
}

function buildPrintHref(basePath: string, period: PrintPeriodKey): string {
  if (typeof window === "undefined") return `${basePath}/${period}`;
  const cur = new URLSearchParams(window.location.search);
  const KEEP = ["d", "grp", "type", "driver", "q"];
  const next = new URLSearchParams();
  for (const key of KEEP) {
    const v = cur.get(key);
    if (v) next.set(key, v);
  }
  const qs = next.toString();
  return qs ? `${basePath}/${period}?${qs}` : `${basePath}/${period}`;
}
