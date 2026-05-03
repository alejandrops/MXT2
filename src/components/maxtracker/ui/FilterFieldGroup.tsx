import type { ReactNode } from "react";
import styles from "./FilterFieldGroup.module.css";

// ═══════════════════════════════════════════════════════════════
//  FilterFieldGroup · L3-style
//  ─────────────────────────────────────────────────────────────
//  Zona con label uppercase chiquito arriba + content abajo.
//  Componente compartido para coherencia visual entre filter
//  bars (Trips, Historial, Boletín y futuros).
//
//  Visual:
//
//   VEHÍCULO              PERÍODO
//   [Asset combo · X]     [‹ 30/04/2026 ›] [Hoy] [Ayer] [⏰ Todo el día ▾]
//
//  Uso:
//    <FilterFieldGroup label="Vehículo">
//      <AssetCombobox ... />
//    </FilterFieldGroup>
//
//    <FilterFieldGroup label="Período">
//      <DayWithTimePicker ... />
//    </FilterFieldGroup>
// ═══════════════════════════════════════════════════════════════

interface Props {
  label: string;
  children: ReactNode;
  /** Si el grupo debe expandirse para llenar espacio · default false */
  flex?: boolean;
}

export function FilterFieldGroup({ label, children, flex = false }: Props) {
  return (
    <div className={`${styles.group} ${flex ? styles.flex : ""}`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
