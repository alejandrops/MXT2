"use client";

import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatMonthLabel, shiftMonth } from "./presets";
import styles from "./MonthPicker.module.css";

// ═══════════════════════════════════════════════════════════════
//  MonthPicker · L3-IA
//  ─────────────────────────────────────────────────────────────
//  Selector específico de mes para el Boletín · NO es un caso
//  del TimeRangePicker porque el boletín es un artefacto
//  editorial cerrado, no un dashboard con rango libre.
//
//  Comportamiento:
//   · Flechas ‹ › navegan mes a mes
//   · Click en el label abre dropdown con lista de meses
//   · Meses con dot verde = tienen datos
//   · Meses sin dot = vacíos (gris)
//   · Click en mes futuro · no permitido (disabled)
//
//  API · `value` y onChange usan formato YYYY-MM (el mismo
//  que la URL del boletín).
// ═══════════════════════════════════════════════════════════════

interface Props {
  /** Período actual en formato YYYY-MM */
  value: string;

  /** Callback al cambiar · recibe nuevo período YYYY-MM */
  onChange: (period: string) => void;

  /**
   * Set de períodos disponibles · usado para mostrar el dot verde.
   * Si no se pasa, todos los meses se muestran sin distinción.
   */
  availableMonths?: readonly string[];

  /** Label visible · default "Mes" */
  label?: string;

  /** Disabled state */
  disabled?: boolean;
}

export function MonthPicker({
  value,
  onChange,
  availableMonths,
  label = "Mes",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al click afuera
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function goPrev() {
    onChange(shiftMonth(value, -1));
  }

  function goNext() {
    onChange(shiftMonth(value, 1));
  }

  // Generar lista de meses para el dropdown · 24 meses hacia atrás
  // desde el actual (cubre 2 años de historia · suficiente para boletín)
  const dropdownItems = generateMonthList(value, 24);

  function isAvailable(period: string): boolean {
    if (!availableMonths) return true;
    return availableMonths.includes(period);
  }

  return (
    <div className={styles.wrap} aria-disabled={disabled} ref={wrapRef}>
      <span className={styles.label}>{label}</span>

      <button
        type="button"
        className={styles.arrow}
        onClick={goPrev}
        disabled={disabled}
        aria-label="Mes anterior"
      >
        <ChevronLeft size={14} />
      </button>

      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{formatMonthLabel(value)}</span>
        <ChevronDown size={12} />
      </button>

      <button
        type="button"
        className={styles.arrow}
        onClick={goNext}
        disabled={disabled}
        aria-label="Mes siguiente"
      >
        <ChevronRight size={14} />
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox">
          {dropdownItems.map((period) => {
            const available = isAvailable(period);
            const active = period === value;
            return (
              <button
                key={period}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.option} ${active ? styles.optionActive : ""} ${!available ? styles.optionEmpty : ""}`}
                onClick={() => {
                  onChange(period);
                  setOpen(false);
                }}
                disabled={disabled}
              >
                <span
                  className={`${styles.dot} ${available ? styles.dotAvailable : styles.dotEmpty}`}
                  aria-hidden="true"
                />
                <span>{formatMonthLabel(period)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Genera una lista de N meses anteriores al actual + el actual,
 * en formato YYYY-MM · ordenado de más reciente a más viejo.
 */
function generateMonthList(currentPeriod: string, count: number): string[] {
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    list.push(shiftMonth(currentPeriod, -i));
  }
  return list;
}
