import { formatTimestamp, type TimestampVariant } from "@/lib/format";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  TimestampCell · S5-T2
//  ─────────────────────────────────────────────────────────────
//  Formato canónico para timestamps en celdas de tabla:
//  dd/mm/yy hh:mm en monoespaciada (variante "short").
//
//  Para paneles de detalle usar variant="long" o "long-seconds".
//  Para columna de día usar variant="date-only".
// ═══════════════════════════════════════════════════════════════

interface Props {
  iso: string | Date | null | undefined;
  variant?: TimestampVariant;
}

export function TimestampCell({ iso, variant = "short" }: Props) {
  return <span className={styles.mono}>{formatTimestamp(iso, variant)}</span>;
}
