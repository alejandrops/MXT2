import type { ReactNode } from "react";
import styles from "./EntityDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  PanelCustomSection · S5-T2
//  ─────────────────────────────────────────────────────────────
//  Contenedor genérico cuando hace falta meter un componente
//  custom (curva velocidad/tiempo, chart, lista de items
//  específica del módulo, etc.).
// ═══════════════════════════════════════════════════════════════

interface Props {
  title?: string;
  children: ReactNode;
}

export function PanelCustomSection({ title, children }: Props) {
  return (
    <section className={styles.section}>
      {title && <div className={styles.sectionTitle}>{title}</div>}
      {children}
    </section>
  );
}
