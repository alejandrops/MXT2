import { formatCoords } from "@/lib/format";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  LocationCell · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  Si hay address → muestra la address (texto normal)
//  Si no → muestra coords en mono · "-34.79242, -58.21453"
//  Si no hay nada → "—"
// ═══════════════════════════════════════════════════════════════

interface Props {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  decimals?: number;
}

export function LocationCell({ lat, lng, address, decimals = 5 }: Props) {
  if (address) {
    return <span>{address}</span>;
  }

  if (lat == null || lng == null) {
    return <span className={styles.muted}>—</span>;
  }

  return (
    <span className={styles.mono}>{formatCoords(lat, lng, decimals)}</span>
  );
}
