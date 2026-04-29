"use client";

import type { ReactNode } from "react";
import styles from "./StateBlocks.module.css";

// ═══════════════════════════════════════════════════════════════
//  ErrorState · cuando algo falla
//  ─────────────────────────────────────────────────────────────
//  Mensaje claro + opcional retry action. Sin emoji ni iconos
//  estridentes. El borde rojo izquierdo lleva la información de
//  severidad · color como excepción.
// ═══════════════════════════════════════════════════════════════

interface Props {
  title: string;
  detail?: string;
  action?: ReactNode;
  size?: "compact" | "normal" | "large";
}

export function ErrorState({
  title,
  detail,
  action,
  size = "normal",
}: Props) {
  return (
    <div
      className={`${styles.state} ${styles[size]} ${styles.error}`}
      role="alert"
    >
      <p className={styles.title}>{title}</p>
      {detail && <p className={styles.hint}>{detail}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
