import { getFleetReplay } from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { FleetTrackingClient } from "./FleetTrackingClient";
import { PageHeader } from "@/components/maxtracker/ui";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Seguimiento › Mapa  · /seguimiento/mapa
//  ─────────────────────────────────────────────────────────────
//  Live fleet tracking via day-replay: every vehicle's last
//  available day of telemetry is loaded, then the client maps
//  "real now" → "replay time" and animates the markers along
//  their actual recorded routes.
//
//  Multi-tenant scoping (U1):
//   · Para CA y OP, la flota se filtra al accountId del session.
//   · Para SA y MA, ven la flota cross-cliente.
//   · `getFleetReplay` admite el segundo parámetro `accountId` desde U1.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function MapaSeguimientoPage() {
  const session = await getSession();
  // El módulo es "seguimiento" para esta vista. Sin filtro de UI
  // aquí · es siempre full fleet del scope del user.
  const scopedAccountId = resolveAccountScope(session, "seguimiento", null);

  const { assets, groups } = await getFleetReplay(new Date(), scopedAccountId);

  return (
    <>
      <PageHeader variant="module" title="Mapa" />
      <div className={`${styles.page} appPageFull`}>
        <FleetTrackingClient initialAssets={assets} groups={groups} />
      </div>
    </>
  );
}
