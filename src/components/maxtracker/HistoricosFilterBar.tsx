"use client";

import { useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  buildHistoricosHref,
  type HistoricosParams,
} from "@/lib/url-historicos";
import { AssetCombobox, type AssetOption } from "./AssetCombobox";
import { DayWithTimePicker, toIsoDateLocal } from "./time";
import { FilterFieldGroup } from "./ui/FilterFieldGroup";
import styles from "./HistoricosFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  HistoricosFilterBar · L3-style · Alt 2 (zonas con labels)
//  ─────────────────────────────────────────────────────────────
//  Layout enterprise-style con 2 zonas claras:
//
//   VEHÍCULO              PERÍODO
//   [Asset combo · X]     [‹ 30/04/2026 ›] [Hoy] [Ayer] [⏰ Todo el día ▾]
//
//  El asset combobox sigue siendo independiente · el bloque de
//  tiempo (DayWithTimePicker) es ahora inline, sin border externo.
//
//  Mapping URL ↔ slider:
//    · current.date     ↔ value.day        (default: hoy local AR)
//    · current.fromTime ↔ value.fromTime   (default: "00:00")
//    · current.toTime   ↔ value.toTime     (default: "24:00")
//
//  Convención URL · "rango activo" requiere ambos fromTime y toTime.
//  Cuando el usuario marca "Todo el día" (fromTime=00:00 + toTime=24:00),
//  guardamos null+null en URL para que la URL quede limpia.
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

  // L3.C · "today" hardcoded a la fecha del demo seed para que los
  // atajos "Hoy" y "Ayer" matcheen con la data disponible.
  const today = useMemo(() => new Date("2026-04-26T12:00:00.000Z"), []);
  const todayIso = useMemo(() => toIsoDateLocal(today, -3), [today]);

  const day = current.date ?? todayIso;
  const fromTime = current.fromTime ?? "00:00";
  const toTime = current.toTime ?? "24:00";

  function handleChange(next: { day: string; fromTime: string; toTime: string }) {
    const isAllDay = next.fromTime === "00:00" && next.toTime === "24:00";
    nav({
      date: next.day,
      fromTime: isAllDay ? null : next.fromTime,
      toTime: isAllDay ? null : next.toTime,
    });
  }

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Vehículo">
        <AssetCombobox
          options={assets}
          selectedId={current.assetId}
          onChange={(id) => nav({ assetId: id })}
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Período">
        <DayWithTimePicker
          value={{ day, fromTime, toTime }}
          onChange={handleChange}
          today={today}
        />
      </FilterFieldGroup>
    </div>
  );
}
