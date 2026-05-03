import {
  getOpenAlarms,
  getSafetyKpis,
  getTopAssetsByEvents,
  getWorstDrivers,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import {
  AlarmCard,
  AssetEventCard,
  DriverScoreCard,
  KpiTile,
  SectionHeader,
} from "@/components/maxtracker";
import { PageHeader } from "@/components/maxtracker/ui";
import { formatNumber } from "@/lib/format";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Seguridad · Dashboard (Patrón D)
//  ─────────────────────────────────────────────────────────────
//  Sub-lote 1.3: Real dashboard with live data from the seed.
//
//  L2B-2 · multi-tenant scope aplicado · CA / OP ven solo su
//  account, SA / MA cross-account.
//
//  Layout:
//    · KPI strip (4 tiles, full width)
//    · Two-column body
//        Col 1 (2fr): Alarmas abiertas con AlarmCard
//        Col 2 (1fr): Top 5 conductores · Top 5 assets
//
//  Force dynamic rendering so KPIs reflect current DB state in
//  dev. In production this will be revalidated on a schedule
//  (KpiDailySnapshot, see audit gap G-04).
// ═══════════════════════════════════════════════════════════════

export const revalidate = 60;

export default async function SeguridadDashboardPage() {
  // L2B-2 · resolver scope multi-tenant para todas las queries
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "seguridad", null);
  const scope = { accountId: scopedAccountId };

  const [kpis, alarms, drivers, assets] = await Promise.all([
    getSafetyKpis(scope),
    getOpenAlarms(15, scope),
    getWorstDrivers(5, scope),
    getTopAssetsByEvents(5, scope),
  ]);

  return (
    <>
      <PageHeader
        variant="module"
        title="Dashboard de seguridad"
        subtitle="Estado en tiempo real · alarmas activas, assets críticos y eventos recientes"
      />
      <div className="appPage">
      {/* ── KPI Strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile
          label="Alarmas activas"
          value={kpis.openAlarmsCount}
          accent={kpis.openAlarmsCount > 0 ? "red" : "grn"}
          caption="Requieren atención"
        />
        <KpiTile
          label="Assets críticos"
          value={kpis.criticalAssetsCount}
          accent={kpis.criticalAssetsCount > 0 ? "red" : "grn"}
          caption="Score conductor < 60"
        />
        <KpiTile
          label="Eventos 24h"
          value={kpis.events24hCount}
          accent="amb"
          caption="Últimas 24 horas"
        />
        <KpiTile
          label="Safety score flota"
          value={kpis.fleetSafetyScore}
          accent={
            kpis.fleetSafetyScore >= 80
              ? "grn"
              : kpis.fleetSafetyScore >= 60
                ? "amb"
                : "red"
          }
          caption="Promedio ponderado"
        />
      </div>

      {/* ── Two-column body ────────────────────────────────── */}
      <div className={styles.body}>
        {/* Left col: open alarms */}
        <section className={styles.left}>
          <SectionHeader
            title="Alarmas abiertas"
            count={kpis.openAlarmsCount}
          />
          {alarms.length === 0 ? (
            <div className={styles.empty}>
              No hay alarmas abiertas. Buen trabajo.
            </div>
          ) : (
            <div className={styles.alarmList}>
              {alarms.map((a) => (
                <AlarmCard key={a.id} alarm={a} />
              ))}
              {kpis.openAlarmsCount > alarms.length && (
                <div className={styles.moreNote}>
                  Mostrando {alarms.length} de{" "}
                  {formatNumber(kpis.openAlarmsCount)}.
                  La lista completa estará en{" "}
                  <code>/seguridad/alarmas</code> (Sub-lote 2.x).
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right col: drivers + assets */}
        <aside className={styles.right}>
          <section className={styles.panel}>
            <SectionHeader title="Top 5 conductores · peor score" />
            {drivers.length === 0 ? (
              <div className={styles.empty}>Sin datos.</div>
            ) : (
              <div className={styles.list}>
                {drivers.map((d) => (
                  <DriverScoreCard key={d.id} driver={d} />
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <SectionHeader title="Top 5 assets · más eventos 30d" />
            {assets.length === 0 ? (
              <div className={styles.empty}>Sin datos.</div>
            ) : (
              <div className={styles.list}>
                {assets.map((a) => (
                  <AssetEventCard key={a.id} asset={a} />
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
      </div>
    </>
  );
}
