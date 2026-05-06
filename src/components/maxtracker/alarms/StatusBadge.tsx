"use client";

import styles from "./StatusBadge.module.css";

// ═══════════════════════════════════════════════════════════════
//  StatusBadge · S5-T5 · Tufte + B&N first
//  ─────────────────────────────────────────────────────────────
//  Muestra el status de una alarma sin depender únicamente del
//  color · usa peso tipográfico + símbolo + texto.
//
//    OPEN       ! Abierta     (bold · borde marcado)
//    ATTENDED   ◐ Atendiendo   (medium · borde fino)
//    CLOSED     ✓ Cerrada      (regular · texto dim)
//    DISMISSED  ✕ Descartada   (regular · texto dim · tachado)
//
//  Funciona idéntico en B&N · el peso, el símbolo y el texto
//  alcanzan para distinguir sin color.
// ═══════════════════════════════════════════════════════════════

export type AlarmStatusValue = "OPEN" | "ATTENDED" | "CLOSED" | "DISMISSED";

const SYMBOL: Record<AlarmStatusValue, string> = {
  OPEN: "!",
  ATTENDED: "◐",
  CLOSED: "✓",
  DISMISSED: "✕",
};

const LABEL: Record<AlarmStatusValue, string> = {
  OPEN: "Abierta",
  ATTENDED: "Atendiendo",
  CLOSED: "Cerrada",
  DISMISSED: "Descartada",
};

const KLASS: Record<AlarmStatusValue, string> = {
  OPEN: "open",
  ATTENDED: "attended",
  CLOSED: "closed",
  DISMISSED: "dismissed",
};

interface Props {
  status: AlarmStatusValue;
  /** Compacto · solo símbolo */
  compact?: boolean;
}

export function StatusBadge({ status, compact }: Props) {
  const klass = KLASS[status];
  return (
    <span className={`${styles.badge} ${styles[klass] ?? ""}`}>
      <span className={styles.symbol} aria-hidden="true">
        {SYMBOL[status]}
      </span>
      {!compact && <span className={styles.label}>{LABEL[status]}</span>}
    </span>
  );
}
