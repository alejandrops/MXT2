import styles from "./KpiTile.module.css";

// ═══════════════════════════════════════════════════════════════
//  KpiTile
//  ─────────────────────────────────────────────────────────────
//  A single KPI block: big numeric value + small uppercase label.
//  The accent prop tints the value to signal severity ("red" for
//  problem metrics, "grn" for healthy ones, "amb" for caution).
// ═══════════════════════════════════════════════════════════════

interface KpiTileProps {
  label: string;
  value: string | number;
  accent?: "red" | "grn" | "amb" | "blu";
  caption?: string;
}

export function KpiTile({ label, value, accent, caption }: KpiTileProps) {
  const accentClass = accent ? styles[`accent_${accent}`] : "";
  return (
    <div className={`${styles.tile} ${accentClass}`}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </div>
  );
}
