import { Hourglass } from "lucide-react";
import sharedStyles from "./ConfiguracionPage.module.css";
import styles from "./PlaceholderTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  PlaceholderTab · estado "próximamente" para tabs A2
//  ─────────────────────────────────────────────────────────────
//  Mostrar el shape final del Configuración con tabs visibles
//  evita la sensación de "esto está incompleto" y prepara al
//  usuario para encontrar las opciones donde van a vivir.
// ═══════════════════════════════════════════════════════════════

interface Props {
  title: string;
  hint: string;
}

export function PlaceholderTab({ title, hint }: Props) {
  return (
    <div className={styles.container}>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>{title}</h2>
      </header>

      <div className={styles.empty}>
        <span className={styles.icon}>
          <Hourglass size={28} />
        </span>
        <span className={styles.emptyTitle}>Próximamente</span>
        <span className={styles.emptyHint}>{hint}</span>
      </div>
    </div>
  );
}
