"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buildHistoricosHref,
  type HistoricosParams,
} from "@/lib/url-historicos";
import { AssetCombobox, type AssetOption } from "./AssetCombobox";
import styles from "./HistoricosFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  HistoricosFilterBar
//  ─────────────────────────────────────────────────────────────
//  Two filters:
//    · asset (combobox with search · matches name/plate/make/model)
//    · date  (native input type="date")
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

  return (
    <div className={styles.bar}>
      {/* ── Asset combobox · search by name/plate/make/model ── */}
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
    </div>
  );
}
