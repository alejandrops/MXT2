import type { ReactNode } from "react";
import styles from "./EntityDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  PanelDataSection · S5-T2
//  ─────────────────────────────────────────────────────────────
//  Grid de pares clave/valor · cada row tiene un label
//  uppercase pequeño en gris a la izquierda y el valor a la
//  derecha. Los valores pueden ser strings o ReactNode (cells).
//
//  Uso:
//    <PanelDataSection rows={[
//      { label: "Fecha", value: <TimestampCell iso={...} variant="long" /> },
//      { label: "Vehículo", value: <VehicleCell asset={...} /> },
//      { label: "Velocidad", value: <SpeedCell kmh={71} /> },
//    ]} />
// ═══════════════════════════════════════════════════════════════

export interface DataRow {
  label: string;
  value: ReactNode;
}

interface Props {
  rows: DataRow[];
  /** Título opcional de la sección · ej. "Detalles" · "Telemetría" */
  title?: string;
}

export function PanelDataSection({ rows, title }: Props) {
  return (
    <section className={styles.section}>
      {title && <div className={styles.sectionTitle}>{title}</div>}
      <div className={styles.dataGrid}>
        {rows.map((r, i) => (
          <div key={i} className={styles.dataRow}>
            <span className={styles.dataLabel}>{r.label}</span>
            <span className={styles.dataValue}>{r.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
