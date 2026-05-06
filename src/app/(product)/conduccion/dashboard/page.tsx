// @ts-nocheck · pre-existing TS errors (Prisma types stale)
import {
  getBestConductores,
  getConduccionKpis,
  getRecentInfractions,
  getWorstConductores,
  CONDUCCION_DEFAULT_PERIOD_DAYS,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import {
  DriverScoreCard,
  KpiTile,
  RecentInfractionCard,
  SectionHeader,
} from "@/components/maxtracker";
import { PageHeader } from "@/components/maxtracker/ui";
import { formatNumber } from "@/lib/format";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Conducción · Dashboard · S4-L3b
//  ─────────────────────────────────────────────────────────────
//  KPIs Tufte (4) sobre los últimos 30 días + lista de
//  infracciones recientes + ranking peores/mejores conductores.
//
//  Layout (clonado del patrón Seguridad → coherencia visual):
//    · KPI strip (4 tiles, full width)
//    · Two-column body
//        Col 1 (2fr): infracciones recientes (graves primero)
//        Col 2 (1fr): top 5 peor score · top 5 mejor score
//
//  Período · 30 días hardcoded en MVP. Period selector llega con
//  S4-L3c (lista de infracciones con filtros).
//
//  Multi-tenant scope · CA/OP ven solo su account, SA/MA cross.
// ═══════════════════════════════════════════════════════════════

export const revalidate = 60;

const RECENT_INFRACTIONS_LIMIT = 12;
const RANKING_LIMIT = 5;

export default async function ConduccionDashboardPage() {
  const session = await getSession();
  // ModuleKey "conduccion" no existe en el sistema de permisos
  // (ver src/lib/permissions.ts). El módulo Conducción comparte
  // permisos con "actividad" · igual que el ScorecardClient
  // existente. Si en el futuro Conducción tiene permisos propios,
  // hay que extender el enum ModuleKey antes.
  const scopedAccountId = resolveAccountScope(session, "actividad", null);
  const scope = { accountId: scopedAccountId };

  const [kpis, recentInfractions, worstDrivers, bestDrivers] = await Promise.all([
    getConduccionKpis(scope),
    getRecentInfractions(RECENT_INFRACTIONS_LIMIT, scope),
    getWorstConductores(RANKING_LIMIT, scope),
    getBestConductores(RANKING_LIMIT, scope),
  ]);

  // Mapear DriverConduccionRow → shape que espera DriverScoreCard
  // (DriverScoreRow expects safetyScore/eventCount30d). Adapta:
  const worstAdapted = worstDrivers.map((d) => ({
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    safetyScore: d.score ?? 100,
    eventCount30d: d.infractionCount,
  }));
  const bestAdapted = bestDrivers.map((d) => ({
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    safetyScore: d.score ?? 0,
    eventCount30d: d.infractionCount,
  }));

  // Formateo del delta · "+3.2 pts" / "−1.5 pts" / "·"
  const deltaText =
    kpis.fleetScoreDelta == null
      ? "—"
      : kpis.fleetScoreDelta === 0
        ? "Sin cambio"
        : `${kpis.fleetScoreDelta > 0 ? "+" : ""}${kpis.fleetScoreDelta.toFixed(0)} pts vs 30d previos`;

  // Banda de color del score flota
  const fleetScoreAccent =
    kpis.fleetScore == null
      ? "gry"
      : kpis.fleetScore >= 80
        ? "grn"
        : kpis.fleetScore >= 60
          ? "amb"
          : "red";

  // Caption del KPI "Conductores en zona roja"
  const redZoneCaption =
    kpis.driversTotal === 0
      ? "Sin conductores activos"
      : `de ${kpis.driversTotal} con datos · ${
          Math.round((kpis.driversInRedZone / kpis.driversTotal) * 100)
        }%`;

  return (
    <>
      <PageHeader
        variant="module"
        title="Dashboard de conducción"
        subtitle="Últimos 30 días · score, infracciones y conductores a foco" helpSlug="conduccion/dashboard"
      />
      <div className="appPage">
        {/* ── KPI Strip ──────────────────────────────────────── */}
        <div className={styles.kpiStrip}>
          <KpiTile
            label="Score flota"
            value={kpis.fleetScore ?? "—"}
            accent={fleetScoreAccent}
            caption={deltaText}
          />
          <KpiTile
            label="Km en exceso"
            value={`${kpis.kmExcessPct.toFixed(1)}%`}
            accent="gry"
            caption={`sobre ${formatNumber(Math.round(kpis.totalKm))} km recorridos`}
          />
          <KpiTile
            label="Conductores en zona roja"
            value={kpis.driversInRedZone}
            accent={kpis.driversInRedZone > 0 ? "red" : "grn"}
            caption={redZoneCaption}
          />
          <KpiTile
            label="Infracciones graves"
            value={kpis.graveInfractionCount}
            accent={kpis.graveInfractionCount > 0 ? "red" : "grn"}
            caption="Exceso ≥ 18 km/h sobre máxima"
          />
        </div>

        {/* ── Two-column body ────────────────────────────────── */}
        <div className={styles.body}>
          {/* Left col: recent infractions */}
          <section className={styles.left}>
            <SectionHeader
              title="Infracciones recientes"
              count={recentInfractions.length}
            />
            {recentInfractions.length === 0 ? (
              <div className={styles.empty}>
                No hubo infracciones en los últimos 30 días.
              </div>
            ) : (
              <div className={styles.alarmList}>
                {recentInfractions.map((inf) => (
                  <RecentInfractionCard key={inf.id} infraction={inf} />
                ))}
                <div className={styles.moreNote}>
                  Lista completa con filtros y mapa de calor en{" "}
                  <code>/conduccion/infracciones</code> (S4-L3c).
                </div>
              </div>
            )}
          </section>

          {/* Right col: rankings */}
          <aside className={styles.right}>
            <section className={styles.panel}>
              <SectionHeader title={`Top ${RANKING_LIMIT} · peor score`} />
              {worstAdapted.length === 0 ? (
                <div className={styles.empty}>Sin datos.</div>
              ) : (
                <div className={styles.list}>
                  {worstAdapted.map((d) => (
                    <DriverScoreCard key={d.id} driver={d} />
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <SectionHeader title={`Top ${RANKING_LIMIT} · mejor score`} />
              {bestAdapted.length === 0 ? (
                <div className={styles.empty}>Sin datos.</div>
              ) : (
                <div className={styles.list}>
                  {bestAdapted.map((d) => (
                    <DriverScoreCard key={d.id} driver={d} />
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
