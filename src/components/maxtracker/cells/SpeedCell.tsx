import { formatSpeed } from "@/lib/format";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  SpeedCell · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  "71 km/h" en monoespaciada. "—" si no hay valor.
// ═══════════════════════════════════════════════════════════════

interface Props {
  kmh: number | null | undefined;
  /** Si se pasa, pinta el número de este color (severity tipicamente) */
  color?: string;
}

export function SpeedCell({ kmh, color }: Props) {
  const formatted = formatSpeed(kmh);
  if (formatted === "—") {
    return <span className={styles.muted}>—</span>;
  }
  return (
    <span className={styles.mono} style={color ? { color } : undefined}>
      {formatted}
    </span>
  );
}
