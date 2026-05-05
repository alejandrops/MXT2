import Link from "next/link";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  VehicleCell · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  Patrón unificado · nombre arriba bold + patente abajo gris
//  mono. Drill-down al libro del vehículo · stopPropagation
//  para no abrir el side panel cuando la fila es clickable.
//
//  Si se pasa `linkable={false}` solo renderiza texto (útil
//  cuando ya estamos dentro del libro del objeto y el link
//  sería al mismo lugar).
// ═══════════════════════════════════════════════════════════════

interface Props {
  asset: {
    id: string;
    name: string;
    plate?: string | null;
  };
  linkable?: boolean;
}

export function VehicleCell({ asset, linkable = true }: Props) {
  const inner = (
    <span className={styles.vehicleStack}>
      <span className={styles.vehicleName}>{asset.name}</span>
      {asset.plate && (
        <span className={styles.vehiclePlate}>{asset.plate}</span>
      )}
    </span>
  );

  if (!linkable) return inner;

  return (
    <Link
      href={`/objeto/vehiculo/${asset.id}`}
      className={styles.link}
      onClick={(e) => e.stopPropagation()}
    >
      {inner}
    </Link>
  );
}
