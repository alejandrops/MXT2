import { AssetDriversPanel } from "@/components/maxtracker/AssetDriversPanel";
import styles from "./DriversBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriversBookTab · S1-L5 libro-conductores-tab
//  ─────────────────────────────────────────────────────────────
//  Tab "Conductores" del Libro del vehículo · solo vehiculo.
//
//  Wrap liviano del componente reusable AssetDriversPanel que ya
//  existe (lee de la tabla precalculada AssetDriverDay):
//    · Tabla de choferes que pasaron por el vehículo · ordenada
//      por último contacto desc, current driver primero
//    · Heatmap semanal · 1 fila por chofer × 53 semanas
//
//  El componente subyacente (AssetDriversPanel) no toca Position
//  · todo viene de la tabla agregada · queries baratas.
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: "vehiculo" | "conductor" | "grupo";
  id: string;
}

export async function DriversBookTab({ type, id }: Props) {
  if (type !== "vehiculo") {
    return (
      <div className={styles.empty}>
        <p>Esta tab solo aplica a vehículos.</p>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <header className={styles.head}>
        <h2 className={styles.title}>Conductores</h2>
        <p className={styles.subtitle}>
          Historial de conductores que pasaron por este vehículo · días,
          viajes, kilómetros y safety score por persona.
        </p>
      </header>

      <AssetDriversPanel assetId={id} />
    </div>
  );
}
