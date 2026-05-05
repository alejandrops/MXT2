"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import type { EventType } from "@/types/domain";
import { EVENT_CATEGORIES, getEventLabel } from "@/lib/event-catalog";
import styles from "./EventTypeFilter.module.css";

// ═══════════════════════════════════════════════════════════════
//  EventTypeFilter · S4-L2 · multi-select agrupado por categoría
//  ─────────────────────────────────────────────────────────────
//  Dropdown con checkboxes:
//    □ Conducción       (toggle todo el grupo)
//      ☑ Frenada brusca
//      □ Aceleración brusca
//      ...
//    □ Seguridad
//      ...
//
//  Default · ningún filtro = TODOS los eventos.
//  Click en categoría · selecciona/deselecciona todos del grupo.
// ═══════════════════════════════════════════════════════════════

interface Props {
  selected: EventType[];
  onChange: (next: EventType[]) => void;
}

export function EventTypeFilter({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const selectedSet = new Set(selected);
  const totalSelected = selected.length;
  const label = totalSelected === 0 ? "Todos los tipos" : `${totalSelected} tipo${totalSelected === 1 ? "" : "s"}`;

  function toggleType(t: EventType) {
    if (selectedSet.has(t)) {
      onChange(selected.filter((x) => x !== t));
    } else {
      onChange([...selected, t]);
    }
  }

  function toggleCategory(cat: { types: EventType[] }) {
    const allSelected = cat.types.every((t) => selectedSet.has(t));
    if (allSelected) {
      // Deselect todos los de la categoría
      onChange(selected.filter((t) => !cat.types.includes(t)));
    } else {
      // Select todos los faltantes de la categoría
      const next = new Set(selected);
      for (const t of cat.types) next.add(t);
      onChange(Array.from(next));
    }
  }

  function clear() {
    onChange([]);
  }

  return (
    <div className={styles.wrap} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${totalSelected > 0 ? styles.triggerActive : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Tipo</span>
        <span className={styles.value}>{label}</span>
        <ChevronDown size={13} className={open ? styles.chevronOpen : ""} />
      </button>

      {totalSelected > 0 && (
        <button
          type="button"
          className={styles.clear}
          onClick={clear}
          title="Limpiar filtro"
        >
          <X size={11} />
        </button>
      )}

      {open && (
        <div className={styles.dropdown}>
          {EVENT_CATEGORIES.map((cat) => {
            const allSelected = cat.types.every((t) => selectedSet.has(t));
            const someSelected = cat.types.some((t) => selectedSet.has(t));

            return (
              <div key={cat.key} className={styles.group}>
                <button
                  type="button"
                  className={styles.groupHeader}
                  onClick={() => toggleCategory(cat)}
                >
                  <span
                    className={`${styles.checkbox} ${
                      allSelected
                        ? styles.checkboxChecked
                        : someSelected
                          ? styles.checkboxMixed
                          : ""
                    }`}
                  />
                  <span className={styles.groupLabel}>{cat.label}</span>
                  <span className={styles.groupCount}>
                    {cat.types.length}
                  </span>
                </button>
                <div className={styles.groupItems}>
                  {cat.types.map((t) => {
                    const checked = selectedSet.has(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        className={styles.item}
                        onClick={() => toggleType(t)}
                      >
                        <span
                          className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ""}`}
                        />
                        <span>{getEventLabel(t)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
