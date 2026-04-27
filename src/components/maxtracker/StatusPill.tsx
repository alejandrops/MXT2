import { ASSET_STATUS_LABEL } from "@/lib/format";
import type { AssetStatus } from "@/types/domain";
import styles from "./StatusPill.module.css";

// ═══════════════════════════════════════════════════════════════
//  StatusPill
//  ─────────────────────────────────────────────────────────────
//  Color-coded badge for AssetStatus values. Reusable across the
//  Lista A, Libro B header, and the future Histórico view.
//
//  Design rationale (Tufte-ish): color carries meaning, not
//  decoration. Each status maps to one semantic token:
//    · MOVING       → green   (operational + dynamic)
//    · IDLE         → blue    (operational + static)
//    · STOPPED      → gray    (paused, neutral)
//    · OFFLINE      → red     (problem)
//    · MAINTENANCE  → amber   (attention required)
// ═══════════════════════════════════════════════════════════════

interface StatusPillProps {
  status: AssetStatus;
  showDot?: boolean;
}

export function StatusPill({ status, showDot = true }: StatusPillProps) {
  return (
    <span className={`${styles.pill} ${styles[`s_${status}`]}`}>
      {showDot && <span className={styles.dot} />}
      {ASSET_STATUS_LABEL[status]}
    </span>
  );
}
