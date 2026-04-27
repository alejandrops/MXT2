import { getFleetReplay } from "@/lib/queries";
import { FleetTrackingClient } from "./FleetTrackingClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Seguimiento › Mapa  · /seguimiento/mapa
//  ─────────────────────────────────────────────────────────────
//  Live fleet tracking via day-replay: every vehicle's last
//  available day of telemetry is loaded, then the client maps
//  "real now" → "replay time" and animates the markers along
//  their actual recorded routes.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function MapaSeguimientoPage() {
  const { assets, groups } = await getFleetReplay();

  return (
    <div className={styles.page}>
      <FleetTrackingClient initialAssets={assets} groups={groups} />
    </div>
  );
}
