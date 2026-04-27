import { HistoricosFilterBar } from "@/components/maxtracker";
import {
  getDailyTrajectory,
  getLatestDateWithData,
  listMobileAssetsForFilter,
} from "@/lib/queries";
import {
  defaultDate,
  parseHistoricosParams,
} from "@/lib/url-historicos";
import { RoutePlayback } from "./RoutePlayback";
import { HistoricosLastSeenSync } from "./HistoricosLastSeenSync";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Históricos · /seguimiento/historial
//  ─────────────────────────────────────────────────────────────
//  Reconstructs an asset's day on a map. Composition:
//    · Filter bar (asset + date)
//    · RoutePlayback (Client) · owns map + scrubber + side panel
//
//  Default behaviour (no URL params):
//    · Server picks the first asset alphabetically and its
//      latest date with data, so the screen always lands on
//      content rather than a blank prompt.
//    · A small client companion (HistoricosLastSeenSync)
//      upgrades that to the user's previously selected asset
//      from localStorage, if any · zero flash on first paint.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HistoricosPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseHistoricosParams(raw);

  const assets = await listMobileAssetsForFilter();

  // Resolve effective asset:
  //   1. URL param wins
  //   2. Fallback to first asset alphabetically (if any)
  let effectiveAssetId = params.assetId;
  if (!effectiveAssetId && assets.length > 0) {
    effectiveAssetId = assets[0]!.id;
  }

  // Resolve effective date:
  //   1. URL param wins
  //   2. If asset is selected, use latest date with data
  //   3. Fallback to defaultDate()
  let effectiveDate = params.date;
  if (!effectiveDate && effectiveAssetId) {
    effectiveDate =
      (await getLatestDateWithData(effectiveAssetId)) ?? defaultDate();
  }
  if (!effectiveDate) {
    effectiveDate = defaultDate();
  }

  const trajectory = effectiveAssetId
    ? await getDailyTrajectory(effectiveAssetId, effectiveDate)
    : null;

  return (
    <div className={styles.page}>
      <HistoricosFilterBar
        current={{ assetId: effectiveAssetId, date: effectiveDate }}
        assets={assets}
      />

      {/* Client-side: if URL had no assetId but localStorage has
          a last-seen asset, redirect there. Otherwise · just save
          the current selection for next time. */}
      <HistoricosLastSeenSync
        urlHadAssetId={params.assetId !== null}
        currentAssetId={effectiveAssetId}
        currentDate={effectiveDate}
        availableAssetIds={assets.map((a) => a.id)}
      />

      {!effectiveAssetId ? (
        <div className={styles.prompt}>
          No hay vehículos disponibles para mostrar.
        </div>
      ) : !trajectory ? (
        <div className={styles.prompt}>
          No se encontró el asset solicitado.
        </div>
      ) : (
        <RoutePlayback trajectory={trajectory} />
      )}
    </div>
  );
}
