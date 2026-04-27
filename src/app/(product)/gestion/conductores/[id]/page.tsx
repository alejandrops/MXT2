import { notFound } from "next/navigation";
import {
  ActivityHeatmap,
  AlarmCard,
  DriverAlarmFilterBar,
  DriverEventFilterBar,
  EventRow,
  KpiTile,
  Pagination,
  PersonHeader,
  SectionHeader,
  Tabs,
  type TabDef,
} from "@/components/maxtracker";
import {
  getDriverActivityHeatmap,
  getPersonDetail,
  listAlarmsByPerson,
  listEventsByPerson,
} from "@/lib/queries";
import {
  buildDriverEventsHref,
  parseDriverEventsParams,
} from "@/lib/url-driver-events";
import {
  buildDriverAlarmsHref,
  parseDriverAlarmsParams,
} from "@/lib/url-driver-alarms";
import { formatNumber } from "@/lib/format";
import type { PersonDetail } from "@/types/domain";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Libro del Conductor (Sub-lote 3.3 · Patrón B)
//  ─────────────────────────────────────────────────────────────
//  /gestion/conductores/[id]
//
//  Mirrors structure of Libro del Asset:
//    PersonHeader → KPI strip → Tabs → tab content
//
//  Tabs:
//    Overview  · Sparkline + recent events + driven assets
//    Eventos   · Paginated event list with filters
//    Alarmas   · Paginated alarm list with filters
//    Documentos· Disabled (Lote 4+)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

type TabKey = "overview" | "actividad" | "eventos" | "alarmas";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LibroConductorPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const [person, activityHeatmap] = await Promise.all([
    getPersonDetail(id),
    getDriverActivityHeatmap(id),
  ]);
  if (!person) notFound();

  const tabParam = typeof sp.tab === "string" ? sp.tab : null;
  const activeTab: TabKey =
    tabParam === "actividad"
      ? "actividad"
      : tabParam === "eventos"
        ? "eventos"
        : tabParam === "alarmas"
          ? "alarmas"
          : "overview";

  const tabs: TabDef[] = [
    { key: "overview", label: "Overview" },
    { key: "actividad", label: "Actividad" },
    { key: "eventos", label: "Eventos", count: person.stats.eventCount30d },
    { key: "alarmas", label: "Alarmas", count: person.stats.openAlarms },
    { key: "documentos", label: "Documentos", disabled: true },
  ];

  return (
    <div className={styles.page}>
      <PersonHeader person={person} />

      {/* ── KPI strip · contextual ─────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile
          label="EVENTOS · 30d"
          value={formatNumber(person.stats.eventCount30d)}
          accent={person.stats.eventCount30d > 10 ? "amb" : undefined}
        />
        <KpiTile
          label="ALARMAS · 30d"
          value={formatNumber(person.stats.alarmCount30d)}
          accent={person.stats.alarmCount30d > 0 ? "red" : "grn"}
          caption={
            person.stats.openAlarms > 0
              ? `${person.stats.openAlarms} abiertas`
              : undefined
          }
        />
        <KpiTile
          label="SAFETY SCORE"
          value={String(person.safetyScore)}
          accent={
            person.safetyScore < 60
              ? "red"
              : person.safetyScore < 80
                ? "amb"
                : "grn"
          }
        />
        <KpiTile
          label="ASSETS"
          value={String(person.drivenAssets.length)}
          caption={
            person.drivenAssets.length === 0
              ? "Sin asignación"
              : "Conduce activamente"
          }
        />
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <Tabs
        basePath={`/gestion/conductores/${id}`}
        tabs={tabs}
        active={activeTab}
      />

      {/* ── Tab content ────────────────────────────────────── */}
      <div className={styles.tabContent}>
        {activeTab === "overview" ? (
          <OverviewTab personId={id} person={person} />
        ) : activeTab === "actividad" ? (
          <ActivityHeatmap
            data={activityHeatmap}
            linkAssetId={person.drivenAssets[0]?.id ?? null}
            title="Actividad del conductor · Últimos 12 meses"
          />
        ) : activeTab === "eventos" ? (
          <EventosTab personId={id} sp={sp} />
        ) : (
          <AlarmasTab personId={id} sp={sp} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Overview tab
// ═══════════════════════════════════════════════════════════════

async function OverviewTab({
  personId,
  person,
}: {
  personId: string;
  person: PersonDetail;
}) {
  // Get recent events for this driver — reuse listEventsByPerson
  // with page=1 and small page size.
  const recent = await listEventsByPerson({
    personId,
    page: 1,
    pageSize: 8,
  });

  return (
    <div className={styles.overview}>
      {/* Left: sparkline + recent events */}
      <section className={styles.leftCol}>
        <SectionHeader title="Actividad · últimos 30 días" />
        <Sparkline data={person.eventHistogram} />

        <SectionHeader title="Eventos recientes" />
        {recent.rows.length === 0 ? (
          <div className={styles.empty}>Sin eventos registrados.</div>
        ) : (
          <div className={styles.list}>
            {recent.rows.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      {/* Right: driven assets */}
      <section className={styles.rightCol}>
        <SectionHeader
          title="Assets que maneja"
          count={person.drivenAssets.length}
        />
        {person.drivenAssets.length === 0 ? (
          <div className={styles.empty}>Sin asignación.</div>
        ) : (
          <div className={styles.assetList}>
            {person.drivenAssets.map((a) => (
              <a
                key={a.id}
                href={`/gestion/vehiculos/${a.id}`}
                className={styles.assetCard}
              >
                <div className={styles.assetName}>{a.name}</div>
                {a.plate && (
                  <div className={styles.assetMeta}>
                    {a.plate}
                    {a.make && a.model && ` · ${a.make} ${a.model}`}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Eventos tab
// ═══════════════════════════════════════════════════════════════

async function EventosTab({
  personId,
  sp,
}: {
  personId: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const params = parseDriverEventsParams(sp);

  const result = await listEventsByPerson({
    personId,
    type: params.driverEventType,
    severity: params.driverEventSeverity,
    page: params.driverEventPage,
    pageSize: 25,
  });

  return (
    <div className={styles.tabSection}>
      <DriverEventFilterBar personId={personId} current={params} />

      {result.rows.length === 0 ? (
        <div className={styles.empty}>
          {params.driverEventType || params.driverEventSeverity
            ? "No hay eventos que cumplan los filtros aplicados."
            : "Este conductor no tiene eventos registrados."}
        </div>
      ) : (
        <div className={styles.list}>
          {result.rows.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}

      {result.total > 0 && (
        <Pagination
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          pageCount={result.pageCount}
          buildHref={(page) =>
            buildDriverEventsHref(personId, params, {
              driverEventPage: page,
            })
          }
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Alarmas tab
// ═══════════════════════════════════════════════════════════════

async function AlarmasTab({
  personId,
  sp,
}: {
  personId: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const params = parseDriverAlarmsParams(sp);

  const result = await listAlarmsByPerson({
    personId,
    status: params.driverAlarmStatus,
    severity: params.driverAlarmSeverity,
    type: params.driverAlarmType,
    domain: "SEGURIDAD",
    page: params.driverAlarmPage,
    pageSize: 25,
  });

  return (
    <div className={styles.tabSection}>
      <DriverAlarmFilterBar personId={personId} current={params} />

      {result.rows.length === 0 ? (
        <div className={styles.empty}>
          {params.driverAlarmStatus ||
          params.driverAlarmSeverity ||
          params.driverAlarmType
            ? "No hay alarmas que cumplan los filtros aplicados."
            : "Este conductor no tiene alarmas asociadas."}
        </div>
      ) : (
        <div className={styles.list}>
          {result.rows.map((a) => (
            <AlarmCard key={a.id} alarm={a} />
          ))}
        </div>
      )}

      {result.total > 0 && (
        <Pagination
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          pageCount={result.pageCount}
          buildHref={(page) =>
            buildDriverAlarmsHref(personId, params, {
              driverAlarmPage: page,
            })
          }
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sparkline · inline SVG (Decisión 3 · Sub-lote 3.3)
//  ─────────────────────────────────────────────────────────────
//  Tiny bar-chart SVG, no library. 30 daily buckets across the
//  width. Bars tinted red if count is at the peak, grey otherwise.
//  This is the only chart in the app for now — when we need more,
//  we'll evaluate Recharts (Lote 4+).
// ═══════════════════════════════════════════════════════════════

function Sparkline({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  if (data.length === 0) {
    return <div className={styles.empty}>Sin datos.</div>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((acc, d) => acc + d.count, 0);
  const peak = data.reduce(
    (best, d) => (d.count > best.count ? d : best),
    data[0]!,
  );

  const W = 600;
  const H = 80;
  const PAD_BOTTOM = 14;
  const PAD_TOP = 6;
  const innerH = H - PAD_BOTTOM - PAD_TOP;
  const barW = W / data.length;
  const gap = 2;

  return (
    <div className={styles.sparklineWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.sparkline}
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const h = (d.count / max) * innerH;
          const x = i * barW + gap / 2;
          const y = PAD_TOP + (innerH - h);
          const w = barW - gap;
          const isPeak = d.count === max && max > 0;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={w}
              height={Math.max(1, h)}
              className={
                d.count === 0
                  ? styles.sparkBarEmpty
                  : isPeak
                    ? styles.sparkBarPeak
                    : styles.sparkBar
              }
            />
          );
        })}

        {/* x-axis labels: leftmost (-30d) and rightmost (today) */}
        <text
          x={4}
          y={H - 2}
          className={styles.sparkAxis}
          textAnchor="start"
        >
          {data[0]!.date.slice(5)}
        </text>
        <text
          x={W - 4}
          y={H - 2}
          className={styles.sparkAxis}
          textAnchor="end"
        >
          hoy
        </text>
      </svg>

      <div className={styles.sparkSummary}>
        <strong>{total}</strong>{" "}
        {total === 1 ? "evento en 30 días" : "eventos en 30 días"}
        {peak.count > 0 && (
          <>
            {" · "}peak el{" "}
            <strong>{formatPeakDate(peak.date)}</strong> con{" "}
            <strong>{peak.count}</strong>
          </>
        )}
      </div>
    </div>
  );
}

function formatPeakDate(iso: string): string {
  // iso = "YYYY-MM-DD"
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}
