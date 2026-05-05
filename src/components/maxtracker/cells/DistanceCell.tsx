import { formatDistance } from "@/lib/format";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  DistanceCell · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  "7.45 km" o "850 m" en monoespaciada.
//  Recibe metros (no km) para evitar ambigüedad.
// ═══════════════════════════════════════════════════════════════

interface Props {
  meters: number | null | undefined;
}

export function DistanceCell({ meters }: Props) {
  const formatted = formatDistance(meters);
  if (formatted === "—") {
    return <span className={styles.muted}>—</span>;
  }
  return <span className={styles.mono}>{formatted}</span>;
}
