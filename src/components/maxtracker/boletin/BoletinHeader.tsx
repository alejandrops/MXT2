"use client";

import { useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { MonthPicker } from "@/components/maxtracker/time";
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
//  · Botón imprimir / guardar PDF (window.print)
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
}

export function BoletinHeader({
  year,
  month,
  nextPeriod,
  availableMonths,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const currentPeriod = useMemo(
    () => `${year}-${String(month).padStart(2, "0")}`,
    [year, month],
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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
          <button
            type="button"
            className={styles.printBtn}
            onClick={handlePrint}
            title="Imprimir o guardar como PDF"
          >
            <Printer size={13} />
            <span>Imprimir / PDF</span>
          </button>
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
