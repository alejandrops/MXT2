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
//
//  Variants (L5.B):
//    · inline   · texto plano sin card · para dropdowns / celdas chicas
//    · compact  · card chica · 16/20 padding
//    · normal   · card mediana · 32/24 padding (default)
//    · large    · card grande · 64/32 padding (pantallas vacías)
// ═══════════════════════════════════════════════════════════════

interface Props {
  title: string;
  hint?: string;
  action?: ReactNode;
  /** Densidad · default "normal" · "inline" para dropdowns sin card */
  size?: "inline" | "compact" | "normal" | "large";
}

export function EmptyState({
  title,
  hint,
  action,
  size = "normal",
}: Props) {
  // Variant inline · texto plano · sin card
  if (size === "inline") {
    return (
      <div className={styles.inline}>
        <span className={styles.inlineText}>{title}</span>
        {hint && <span className={styles.inlineHint}>{hint}</span>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    );
  }

  return (
    <div className={`${styles.state} ${styles[size]}`}>
      <p className={styles.title}>{title}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
