"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import styles from "./MultiSelect.module.css";

// ═══════════════════════════════════════════════════════════════
//  MultiSelect · dropdown reusable con chips, búsqueda y selección
//  múltiple. Pensado para los filtros de Análisis · escala bien
//  hasta ~200 opciones (lista virtualizada no necesaria a esa escala).
// ═══════════════════════════════════════════════════════════════

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Para vehículos: patente o subgrupo · se muestra junto al label */
  hint?: string;
}

interface Props {
  /** Etiqueta del filtro (ej "Grupos") · se muestra en el botón */
  label: string;
  /** Icono opcional a la izquierda */
  icon?: React.ReactNode;
  options: MultiSelectOption[];
  /** Valores actualmente seleccionados */
  value: string[];
  onChange: (next: string[]) => void;
  /** Si no hay nada seleccionado · etiqueta a mostrar */
  emptyLabel?: string;
  /** Width del dropdown · default 280 */
  menuWidth?: number;
  /** Placeholder del search */
  searchPlaceholder?: string;
}

export function MultiSelect({
  label,
  icon,
  options,
  value,
  onChange,
  emptyLabel = "Todos",
  menuWidth = 280,
  searchPlaceholder = "Buscar…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const valueSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  function toggle(val: string) {
    if (valueSet.has(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  }

  function clearAll() {
    onChange([]);
  }

  function selectAllVisible() {
    const allVisible = filtered.map((o) => o.value);
    const merged = Array.from(new Set([...value, ...allVisible]));
    onChange(merged);
  }

  // Display string: "Todos" if empty, "{label}: 3" if multi
  const displayValue = (() => {
    if (value.length === 0) return emptyLabel;
    if (value.length === 1) {
      const opt = options.find((o) => o.value === value[0]);
      return opt?.label ?? value[0];
    }
    return `${value.length} seleccionados`;
  })();

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${value.length > 0 ? styles.triggerActive : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {icon && <span className={styles.triggerIcon}>{icon}</span>}
        <span className={styles.triggerLabel}>{label}:</span>
        <span className={styles.triggerValue}>{displayValue}</span>
        <ChevronDown size={11} className={styles.triggerChev} />
      </button>

      {open && (
        <div
          className={styles.menu}
          role="listbox"
          aria-multiselectable="true"
          style={{ width: menuWidth }}
        >
          <div className={styles.searchWrap}>
            <Search size={12} className={styles.searchIcon} />
            <input
              type="text"
              autoFocus
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setQuery("")}
              >
                <X size={11} />
              </button>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={selectAllVisible}
              disabled={filtered.length === 0}
            >
              {query ? "Seleccionar visibles" : "Seleccionar todos"}
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={clearAll}
              disabled={value.length === 0}
            >
              Limpiar ({value.length})
            </button>
          </div>

          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>Sin resultados.</div>
            ) : (
              filtered.map((o) => {
                const checked = valueSet.has(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`${styles.option} ${checked ? styles.optionChecked : ""}`}
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(o.value)}
                  >
                    <span className={styles.optionCheck}>
                      {checked && <Check size={12} />}
                    </span>
                    <span className={styles.optionLabel}>{o.label}</span>
                    {o.hint && (
                      <span className={styles.optionHint}>{o.hint}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
