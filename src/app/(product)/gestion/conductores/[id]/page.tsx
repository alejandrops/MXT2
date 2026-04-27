import { notFound } from "next/navigation";
import {
  ActivityHeatmap,
  AlarmCard,
  DriverAlarmFilterBar,
  DriverAssetsPanel,
  DriverEventFilterBar,
  EventRow,
  KpiTile,
  Pagination,
  PersonHeader,
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
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Libro del Conductor (F7 · refactor)
//  ─────────────────────────────────────────────────────────────
//  /gestion/conductores/[id]
//
//  Tabs:
//    · Vehículos · espejo del E5-A · tabla + heatmap por asset
//    · Actividad · heatmap del conductor
//    · Eventos   · paginado con filtros
//    · Alarmas   · paginado con filtros
//    · Documentos· disabled
//
//  Cambio respecto del original: el tab "Overview" se elimina
//  (el sparkline + recent events + driven assets quedaba flojo).
//  En su lugar entra "Vehículos manejados" como tab principal.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

type TabKey = "vehiculos" | "actividad" | "eventos" | "alarmas";

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
          : "vehiculos";

  const tabs: TabDef[] = [
    { key: "vehiculos", label: "Vehículos" },
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
        {activeTab === "vehiculos" ? (
          <DriverAssetsPanel personId={id} />
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

