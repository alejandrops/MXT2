"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonthPicker } from "@/components/maxtracker/time";
import { ExportMenu } from "@/components/maxtracker/ui/ExportMenu";
import styles from "./BoletinHeader.module.css";

// ═══════════════════════════════════════════════════════════════
//  BoletinHeader · L3.D · MonthPicker integrado
//  ─────────────────────────────────────────────────────────────
//  · Título editorial grande · "Boletín mensual · Marzo 2026"
//  · MonthPicker (componente unificado · L3-IA) reemplaza las
//    flechas Anterior/Siguiente con un selector más rico:
//      - flechas ‹ › prev/next igual que antes
//      - dropdown con lista de meses históricos (24 meses)
//      - dot verde por meses con datos disponibles
//  · ExportMenu unificado (S1-L1 fix F3) · combina Excel + Imprimir/PDF
//    en un solo dropdown · reemplaza los 2 botones separados anteriores.
//
//  En print stylesheet los controles se ocultan · queda solo
//  el título.
// ═══════════════════════════════════════════════════════════════

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Payload mínimo para generar el Excel · matchea la shape del
 *  generador en lib/excel/boletin.ts */
export interface BoletinExportPayload {
  summary: {
    current: {
      distanceKm: number;
      activeMin: number;
      tripCount: number;
      eventCount: number;
      alarmCount: number;
      activeAssetCount: number;
      activeDriverCount: number;
    };
    previous: {
      distanceKm: number;
      activeMin: number;
      tripCount: number;
      eventCount: number;
      alarmCount: number;
    };
    fleet: {
      totalAssets: number;
      totalDrivers: number;
      totalGroups: number;
    };
  };
  vehicles: {
    assetId: string;
    assetName: string;
    plate: string | null;
    groupName: string | null;
    distanceKm: number;
    activeMin: number;
    tripCount: number;
    eventCount: number;
    eventsPer100km: number;
  }[];
  drivers: {
    personId: string;
    fullName: string;
    safetyScore: number;
    distanceKm: number;
    tripCount: number;
    eventCount: number;
  }[];
  groups: {
    groupId: string;
    groupName: string;
    assetCount: number;
    distanceKm: number;
    activeMin: number;
    tripCount: number;
    eventCount: number;
    eventsPer100km: number;
  }[];
  alarms: {
    total: number;
    activeAtClose: number;
    mttrMin: number;
    bySeverity: { severity: string; count: number }[];
    byDomain: { domain: string; count: number }[];
    topVehicles: {
      assetId: string;
      assetName: string;
      plate: string | null;
      count: number;
    }[];
  };
  events: { type: string; count: number }[];
}

interface Props {
  year: number;
  month: number;
  /** Mantenido por compat · MonthPicker calcula prev/next solo */
  prevPeriod: string;
  /** Si es null, el mes actual es el último cerrado · MonthPicker
   *  igualmente permite navegar hacia atrás · este flag se usa
   *  solo para deshabilitar el "next" cuando estamos en el límite. */
  nextPeriod: string | null;
  /**
   * Lista opcional de períodos con datos disponibles · si se pasa,
   * MonthPicker muestra dot verde junto a esos meses en el dropdown.
   * Default: undefined · todos los meses se ven sin distinción.
   */
  availableMonths?: readonly string[];
  /**
   * Data del boletín · si se pasa, se habilita el botón Excel.
   * Si es undefined (caso fallback), solo se muestra el botón Imprimir.
   */
  exportPayload?: BoletinExportPayload;
}

export function BoletinHeader({
  year,
  month,
  nextPeriod,
  availableMonths,
  exportPayload,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [xlsxStatus, setXlsxStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );

  const currentPeriod = useMemo(
    () => `${year}-${String(month).padStart(2, "0")}`,
    [year, month],
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  async function handleExportXlsx() {
    if (!exportPayload || xlsxStatus === "loading") return;
    setXlsxStatus("loading");
    try {
      const periodLabel = `${MONTHS[month - 1]} ${year}`;
      const res = await fetch("/api/export/xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "boletin-with-data",
          period: currentPeriod,
          periodLabel,
          payload: exportPayload,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boletin_${currentPeriod}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setXlsxStatus("idle");
    } catch (err) {
      console.error("[BoletinHeader] export xlsx failed", err);
      setXlsxStatus("error");
      setTimeout(() => setXlsxStatus("idle"), 3000);
    }
  }

  function handleChange(newPeriod: string) {
    // Si el user intenta navegar al mes que aún no cerró (futuro),
    // no permitir · nextPeriod=null indica que estamos en el último
    // mes cerrado. Comparación de strings YYYY-MM funciona porque
    // ordenan lexicográficamente.
    if (nextPeriod === null && newPeriod > currentPeriod) return;
    startTransition(() => {
      router.push(`/direccion/boletin/${newPeriod}`);
    });
  }

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <span className={styles.crumb}>Dirección · Boletín</span>

        <div className={styles.barCenter}>
          <MonthPicker
            value={currentPeriod}
            onChange={handleChange}
            availableMonths={availableMonths}
            label="Mes"
          />
        </div>

        <div className={styles.barRight}>
          {xlsxStatus !== "idle" && (
            <span
              className={
                xlsxStatus === "error" ? styles.statusError : styles.statusLoading
              }
              role="status"
              aria-live="polite"
            >
              {xlsxStatus === "loading"
                ? "Generando…"
                : "Error · reintentá"}
            </span>
          )}
          <ExportMenu
            onExportXlsx={
              exportPayload && xlsxStatus !== "loading" ? handleExportXlsx : null
            }
            onPrintDocument={handlePrint}
          />
        </div>
      </div>

      <div className={styles.title}>
        <h1 className={styles.titleMain}>Boletín mensual</h1>
        <span className={styles.titlePeriod}>
          {MONTHS[month - 1]} {year}
        </span>
        <p className={styles.subtitle}>
          Resumen ejecutivo del cierre operativo · indicadores clave de la
          flota, conducción, seguridad y observaciones del período.
        </p>
      </div>
    </header>
  );
}
