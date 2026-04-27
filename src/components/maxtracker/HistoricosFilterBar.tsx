"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  buildHistoricosHref,
  type HistoricosParams,
} from "@/lib/url-historicos";
import { AssetCombobox, type AssetOption } from "./AssetCombobox";
import styles from "./HistoricosFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  HistoricosFilterBar
//  ─────────────────────────────────────────────────────────────
//  Filters:
//    · asset      (combobox · name/plate/make/model)
//    · date       (native <input type="date">)
//    · from / to  (HH:MM time range · F2)
//
//  Time-range semantics:
//    · Both empty → full day
//    · Both set & from < to → clip applied
//    · "X" button (visible cuando hay rango activo) limpia ambos
//    · Cambiar la fecha NO resetea automáticamente from/to · si
//      no aplican al nuevo día se recalculan a full-day (la
//      query siempre intersecta con el día efectivo)
// ═══════════════════════════════════════════════════════════════

interface HistoricosFilterBarProps {
  current: HistoricosParams;
  assets: AssetOption[];
}

export function HistoricosFilterBar({
  current,
  assets,
}: HistoricosFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function nav(override: Partial<HistoricosParams>) {
    const href = buildHistoricosHref(current, override);
    startTransition(() => router.push(href));
  }

  // Compute the effective time range that's currently rendered.
  // We treat both unset OR invalid as "no range".
  const hasRange = !!(current.fromTime && current.toTime);

  // Local handlers · we hold uncommitted edits in URL state via a
  // small intermediate. To keep this simple we commit on change
  // (the user types and it nav's) · same pattern as date input.
  function setFrom(value: string) {
    const next = value === "" ? null : value;
    // If the user clears `from`, clear both (range needs both).
    if (next === null) {
      nav({ fromTime: null, toTime: null });
      return;
    }
    // If `to` exists but is now <= `from`, clear `to` so the URL
    // state stays valid (parseHistoricosParams would discard it
    // anyway, but this avoids a flash of "invalid range" UI).
    const to = current.toTime;
    if (to && next >= to) {
      nav({ fromTime: next, toTime: null });
    } else {
      nav({ fromTime: next });
    }
  }
  function setTo(value: string) {
    const next = value === "" ? null : value;
    if (next === null) {
      nav({ fromTime: null, toTime: null });
      return;
    }
    const from = current.fromTime;
    if (from && next <= from) {
      // User picked a "to" earlier than "from" · ignore (the
      // parser will reject it anyway, but fail fast in the UI)
      return;
    }
    nav({ toTime: next });
  }

  return (
    <div className={styles.bar}>
      {/* ── Asset combobox ───────────────────────────────────── */}
      <AssetCombobox
        options={assets}
        selectedId={current.assetId}
        onChange={(id) => nav({ assetId: id })}
      />

      {/* ── Date picker ──────────────────────────────────────── */}
      <label
        className={`${styles.select} ${
          current.date ? styles.selectActive : ""
        }`}
      >
        <span className={styles.selectLabel}>Fecha</span>
        <input
          type="date"
          value={current.date ?? ""}
          onChange={(e) =>
            nav({ date: e.target.value === "" ? null : e.target.value })
          }
          className={styles.dateInput}
        />
      </label>

      {/* ── Time range · from / to (F2) ─────────────────────── */}
      <label
        className={`${styles.select} ${hasRange ? styles.selectActive : ""}`}
      >
        <span className={styles.selectLabel}>Desde</span>
        <input
          type="time"
          lang="es-AR"
          value={current.fromTime ?? ""}
          onChange={(e) => setFrom(e.target.value)}
          className={styles.timeInput}
        />
      </label>

      <label
        className={`${styles.select} ${hasRange ? styles.selectActive : ""}`}
      >
        <span className={styles.selectLabel}>Hasta</span>
        <input
          type="time"
          lang="es-AR"
          value={current.toTime ?? ""}
          onChange={(e) => setTo(e.target.value)}
          className={styles.timeInput}
        />
      </label>

      {hasRange && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => nav({ fromTime: null, toTime: null })}
          title="Quitar rango horario · ver día completo"
        >
          <X size={13} />
          <span>Día completo</span>
        </button>
      )}
    </div>
  );
}

