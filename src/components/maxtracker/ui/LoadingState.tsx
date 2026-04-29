"use client";

import styles from "./StateBlocks.module.css";

// ═══════════════════════════════════════════════════════════════
//  LoadingState · loading consistente · sin spinners llamativos
//  ─────────────────────────────────────────────────────────────
//  Para data fetches que no usan Suspense streaming. Texto simple
//  + barra de progreso indeterminada minimalista.
// ═══════════════════════════════════════════════════════════════

interface Props {
  label?: string;
  size?: "compact" | "normal" | "large";
}

export function LoadingState({ label = "Cargando…", size = "normal" }: Props) {
  return (
    <div className={`${styles.state} ${styles[size]}`} aria-live="polite" role="status">
      <p className={styles.title}>{label}</p>
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} />
      </div>
    </div>
  );
}
