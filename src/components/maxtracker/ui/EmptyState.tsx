"use client";

import type { ReactNode } from "react";
import styles from "./StateBlocks.module.css";

// ═══════════════════════════════════════════════════════════════
//  EmptyState · cuando no hay datos
//  ─────────────────────────────────────────────────────────────
//  Tufte · texto centrado · sin iconos decorativos · sin colores
//  llamativos. Solo informa.
//
//  Siempre 2 niveles:
//    title   · qué pasa · 1 línea ("Sin vehículos en el período")
//    hint    · qué hacer · opcional ("Probá ampliar el rango...")
//
//  Action opcional para que el usuario pueda salir del estado.
// ═══════════════════════════════════════════════════════════════

interface Props {
  title: string;
  hint?: string;
  action?: ReactNode;
  /** Densidad · default normal · compact en celdas pequeñas */
  size?: "compact" | "normal" | "large";
}

export function EmptyState({
  title,
  hint,
  action,
  size = "normal",
}: Props) {
  return (
    <div className={`${styles.state} ${styles[size]}`}>
      <p className={styles.title}>{title}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
