// @ts-nocheck · scaffold inicial · types se afinan en S1-L7 cuando se agreguen los KPIs reales
import { PageHeader } from "@/components/maxtracker/ui";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /dashboard · Home cross-módulo · "el ahora" de toda la flota
//  ─────────────────────────────────────────────────────────────
//  Pantalla de entrada del producto · operacional, no analítica.
//  Muestra el estado actual de toda la flota cross-módulo:
//    · vehículos en movimiento / detenidos / sin reportar
//    · alarmas activas (cross-módulo, no solo Seguridad)
//    · top issues del día (excesos, infracciones, eventos críticos)
//    · mini-mapa con clustering
//    · atajos a Libros recientes / favoritos
//
//  Diferencia conceptual con el módulo Dirección:
//    · Dirección · análisis estadístico cross-módulo (período histórico)
//    · /dashboard · operacional (tiempo real)
//
//  S1-L2 · scaffold solo · placeholders. El contenido real se
//  arma en S1-L7 cuando estén los datos reales conectados.
// ═══════════════════════════════════════════════════════════════

export const revalidate = 60;

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        variant="module"
        title="Dashboard"
        subtitle="Estado actual de la flota · cross-módulo"
        helpSlug="dashboard"
      />

      <div className={styles.body}>
        <div className={styles.placeholder}>
          <h2 className={styles.phTitle}>Home en construcción</h2>
          <p className={styles.phText}>
            Esta pantalla va a mostrar el estado en vivo de toda la flota:
            vehículos activos, alarmas abiertas, eventos del día y atajos a
            Libros recientes. Se construye en S1-L7 cuando estén los datos
            conectados.
          </p>
          <p className={styles.phText}>
            Mientras tanto, navegá por los módulos desde el menú lateral.
          </p>
        </div>
      </div>
    </div>
  );
}
