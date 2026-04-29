"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import styles from "./BoletinHeader.module.css";

// ═══════════════════════════════════════════════════════════════
//  BoletinHeader · capa identidad del boletín
//  ─────────────────────────────────────────────────────────────
//  · Título editorial grande · "Boletín mensual · Marzo 2026"
//  · Navegador prev/next entre meses (next solo si está cerrado)
//  · Botón imprimir / guardar PDF (window.print)
//
//  En print stylesheet el botón se oculta · queda solo el título.
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
  prevPeriod: string;
  /** Si es null, no hay siguiente (todavía no cerró) */
  nextPeriod: string | null;
}

export function BoletinHeader({
  year,
  month,
  prevPeriod,
  nextPeriod,
}: Props) {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href={`/direccion/boletin/${prevPeriod}`} className={styles.nav}>
          <ChevronLeft size={14} />
          <span>Anterior</span>
        </Link>

        <span className={styles.crumb}>Dirección · Boletín</span>

        <div className={styles.barRight}>
          {nextPeriod ? (
            <Link
              href={`/direccion/boletin/${nextPeriod}`}
              className={styles.nav}
            >
              <span>Siguiente</span>
              <ChevronRight size={14} />
            </Link>
          ) : (
            <span className={`${styles.nav} ${styles.navDisabled}`}>
              <span>Siguiente</span>
              <ChevronRight size={14} />
            </span>
          )}
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
