"use client";

import { ChevronDown } from "lucide-react";
import styles from "./SelectField.module.css";

// ═══════════════════════════════════════════════════════════════
//  SelectField · L3-style-2 · select reusable
//  ─────────────────────────────────────────────────────────────
//  Native <select> con 2 variantes:
//
//   · variant="pill" (default · legacy)
//     Muestra "[LABEL: value]" tipo pill · usado por filter bars
//     que aún no migraron a FilterFieldGroup.
//
//   · variant="bare"
//     Solo muestra el value (sin prefix). Diseñado para vivir
//     dentro de un <FilterFieldGroup label="..."> que ya provee
//     el label arriba · evita doble labelling.
//
//  Ambas variantes mantienen el mismo native <select> para
//  accesibilidad, keyboard nav y mobile UX.
// ═══════════════════════════════════════════════════════════════

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string | null;
  options: Option[];
  onChange: (value: string | null) => void;
  /** "Todos" / "Sin filtrar" · default "Todos" */
  emptyLabel?: string;
  /** "pill" muestra "LABEL: value" · "bare" solo value · default "pill" */
  variant?: "pill" | "bare";
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  emptyLabel = "Todos",
  variant = "pill",
  disabled = false,
}: Props) {
  const isActive = value !== null;
  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption?.label ?? emptyLabel;

  return (
    <label
      className={`${styles.field} ${isActive ? styles.fieldActive : ""}`}
      aria-disabled={disabled}
    >
      {variant === "pill" && (
        <span className={styles.label}>{label}</span>
      )}
      <span className={styles.value}>{displayValue}</span>
      <ChevronDown size={12} className={styles.chev} aria-hidden="true" />
      <select
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value)
        }
        disabled={disabled}
        className={styles.native}
        aria-label={label}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
