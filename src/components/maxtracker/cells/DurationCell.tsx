import { formatDuration, formatDurationFromSec } from "@/lib/format";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  DurationCell · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  Acepta segundos o milisegundos · una de las dos props.
//
//  ms  · "2h 35m" (formatDuration existente, formato día/hora)
//  sec · "6m 17s" (formatDurationFromSec, más granular para
//        eventos cortos como infracciones)
// ═══════════════════════════════════════════════════════════════

interface Props {
  ms?: number | null | undefined;
  sec?: number | null | undefined;
}

export function DurationCell({ ms, sec }: Props) {
  let formatted: string;
  if (sec !== undefined) {
    formatted = formatDurationFromSec(sec);
  } else if (ms !== undefined) {
    formatted = formatDuration(ms ?? 0);
  } else {
    formatted = "—";
  }

  if (formatted === "—") {
    return <span className={styles.muted}>—</span>;
  }
  return <span className={styles.mono}>{formatted}</span>;
}
