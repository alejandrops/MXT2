import type { ReactNode } from "react";
import styles from "./EntityDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  PanelActionsSection · S5-T2
//  ─────────────────────────────────────────────────────────────
//  Bloque al pie del panel para acciones contextuales:
//  · Abrir recibo imprimible
//  · Descartar (con razón)
//  · Ver en libro del objeto
//  · etc.
//
//  Layout · botones en columna o row según `direction`.
// ═══════════════════════════════════════════════════════════════

interface Props {
  children: ReactNode;
  direction?: "row" | "column";
  title?: string;
}

export function PanelActionsSection({
  children,
  direction = "column",
  title,
}: Props) {
  return (
    <section className={styles.section}>
      {title && <div className={styles.sectionTitle}>{title}</div>}
      <div
        className={styles.actions}
        style={{ flexDirection: direction === "row" ? "row" : "column" }}
      >
        {children}
      </div>
    </section>
  );
}
