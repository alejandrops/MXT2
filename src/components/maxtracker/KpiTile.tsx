import styles from "./KpiTile.module.css";

// ═══════════════════════════════════════════════════════════════
//  KpiTile · L5.B · layout enterprise-standard
//  ─────────────────────────────────────────────────────────────
//  Card simple con label arriba (uppercase chiquito) y value
//  abajo (grande). Layout coherente con KpiCard.size="sm" ·
//  visualmente intercambiable.
//
//  La API se mantiene igual desde versiones anteriores ·
//  consumers no necesitan migración.
//
//  Si necesitás delta vs período / peer comparison · usar KpiCard
//  directamente (más completo pero también más pesado).
// ═══════════════════════════════════════════════════════════════

interface KpiTileProps {
  label: string;
  value: string | number;
  /** Tinta el value · señaliza severidad ("red" problema · "grn" healthy · "amb" caution · "blu" info) */
  accent?: "red" | "grn" | "amb" | "blu";
  /** Texto chico debajo del value · contexto adicional */
  caption?: string;
}

export function KpiTile({ label, value, accent, caption }: KpiTileProps) {
  const accentClass = accent ? styles[`accent_${accent}`] : "";
  return (
    <div className={`${styles.tile} ${accentClass}`}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </div>
  );
}
