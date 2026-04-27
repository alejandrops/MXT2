import { notFound } from "next/navigation";
import {
  ActivityHeatmap,
  AlarmCard,
  AssetDayRouteCard,
  AssetDriversPanel,
  AssetHeader,
  AssetLiveStatus,
  AssetMapTab,
  EventFilterBar,
  EventRow,
  KpiTile,
  Pagination,
  SectionHeader,
  Tabs,
  type TabDef,
} from "@/components/maxtracker";
import { TripsTable } from "@/components/maxtracker/TripsTable";
import {
  getAlarmsByAsset,
  getAssetActivityHeatmap,
  getAssetDayMap,
  getAssetDetail,
  getRecentEventsByAsset,
  listEventsByAsset,
  listTrips,
} from "@/lib/queries";
import {
  buildAssetEventsHref,
  parseAssetEventsParams,
} from "@/lib/url-asset-events";
import {
  buildAssetHistoricoHref,
  parseAssetHistoricoSort,
} from "@/lib/url-asset-historico";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Seguridad / Asset Detail (Libro B) — Patrón B
//  ─────────────────────────────────────────────────────────────
//  Sub-lote 1.5: full implementation.
//
//  Anatomy:
//    · AssetHeader (back link, title, status, meta)
//    · KPI strip (eventos 30d / alarmas 30d / abiertas / score)
//    · Tabs: Overview · Histórico · Alarmas · Eventos · Persona · Devices
//    · Tab content (Overview or Alarmas in this lote)
//
//  Tab state lives in `?tab=...`. Default (no param) = Overview.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

type TabKey =
  | "overview"
  | "actividad"
  | "mapa"
  | "alarmas"
  | "eventos"
  | "historico"
  | "conductor"
  | "devices";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AssetDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const [asset, activityHeatmap] = await Promise.all([
    getAssetDetail(id),
    getAssetActivityHeatmap(id),
  ]);
  if (!asset) notFound();

  const tabParam = typeof sp.tab === "string" ? sp.tab : null;
  const activeTab: TabKey =
    tabParam === "actividad"
      ? "actividad"
      : tabParam === "mapa"
        ? "mapa"
        : tabParam === "alarmas"
          ? "alarmas"
          : tabParam === "eventos"
            ? "eventos"
            : tabParam === "historico"
              ? "historico"
              : tabParam === "conductor"
                ? "conductor"
                : tabParam === "devices"
                  ? "devices"
                  : "overview";

  const tabs: TabDef[] = [
    { key: "overview", label: "Overview" },
    { key: "actividad", label: "Actividad" },
    { key: "mapa", label: "Mapa" },
    {
      key: "historico",
      label: "Histórico",
    },
    {
      key: "alarmas",
      label: "Alarmas",
      count: asset.stats.alarmCount30d,
    },
    {
      key: "eventos",
      label: "Eventos",
      count: asset.stats.eventCount30d,
    },
    {
      key: "conductor",
      label: "Conductor",
    },
    {
      key: "devices",
      label: "Devices",
      count: asset.devices.length,
    },
  ];

  return (
    <div className={styles.page}>
      <AssetHeader asset={asset} />

      {/* ── Live status block · alarm + state + asset data ── */}
      <AssetLiveStatus asset={asset} />

      {/* ── KPI Strip · period (30d) + safety ───────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile
          label="Km · 30d"
          value={asset.stats.km30d.toLocaleString("es-AR")}
          caption="kilómetros recorridos"
        />
        <KpiTile
          label="Tiempo activo · 30d"
          value={formatHours(asset.stats.activeMinutes30d)}
          caption="motor encendido"
        />
        <KpiTile
          label="Viajes · 30d"
          value={asset.stats.tripCount30d}
        />
        <KpiTile
          label="Eventos · 30d"
          value={asset.stats.eventCount30d}
          accent={asset.stats.eventCount30d > 5 ? "amb" : undefined}
        />
        <KpiTile
          label="Alarmas abiertas"
          value={asset.stats.openAlarms}
          accent={asset.stats.openAlarms > 0 ? "red" : "grn"}
        />
        <KpiTile
          label="Safety score conductor"
          value={asset.currentDriver?.safetyScore ?? "—"}
          accent={
            asset.currentDriver
              ? asset.currentDriver.safetyScore >= 80
                ? "grn"
                : asset.currentDriver.safetyScore >= 60
                  ? "amb"
                  : "red"
              : undefined
          }
          caption={
            asset.currentDriver
              ? `${asset.currentDriver.firstName} ${asset.currentDriver.lastName}`
              : "Sin conductor"
          }
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Tabs
        basePath={`/gestion/vehiculos/${id}`}
        tabs={tabs}
        active={activeTab}
      />

      {/* ── Tab content ─────────────────────────────────────── */}
      <div className={styles.tabContent}>
        {activeTab === "overview" ? (
          <OverviewTab assetId={id} asset={asset} />
        ) : activeTab === "actividad" ? (
          <ActivityHeatmap
            data={activityHeatmap}
            linkAssetId={asset.id}
            title="Actividad del vehículo · Últimos 12 meses"
          />
        ) : activeTab === "mapa" ? (
          <MapaTab assetId={id} />
        ) : activeTab === "alarmas" ? (
          <AlarmasTab assetId={id} />
        ) : activeTab === "historico" ? (
          <HistoricoTab assetId={id} sp={sp} />
        ) : activeTab === "conductor" ? (
          <AssetDriversPanel assetId={id} />
        ) : activeTab === "devices" ? (
          <DevicesTab asset={asset} />
        ) : (
          <EventosTab assetId={id} sp={sp} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Overview tab · Map + recent events + open alarms
// ═══════════════════════════════════════════════════════════════

async function OverviewTab({
  assetId,
  asset,
}: {
  assetId: string;
  asset: NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>;
}) {
  const [recentEvents, openAlarms, dayMap] = await Promise.all([
    getRecentEventsByAsset(assetId, 8),
    getAlarmsByAsset(assetId, {
      status: "OPEN",
      limit: 5,
      domain: "SEGURIDAD",
    }),
    getAssetDayMap(assetId),
  ]);

  return (
    <div className={styles.overview}>
      {/* Left col: day route map + day stats (E5-C) */}
      <section className={styles.mapColumn}>
        {dayMap ? (
          <AssetDayRouteCard assetId={assetId} dayMap={dayMap} />
        ) : (
          <div className={styles.empty}>
            No fue posible cargar el mapa de este vehículo.
          </div>
        )}
      </section>

      {/* Right col: events + alarms */}
      <aside className={styles.sideColumn}>
        <section className={styles.panel}>
          <SectionHeader
            title="Eventos recientes"
            count={asset.stats.eventCount30d}
          />
          {recentEvents.length === 0 ? (
            <div className={styles.empty}>Sin eventos recientes.</div>
          ) : (
            <div className={styles.list}>
              {recentEvents.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <SectionHeader
            title="Alarmas abiertas"
            count={asset.stats.openAlarms}
          />
          {openAlarms.length === 0 ? (
            <div className={styles.empty}>
              {asset.stats.alarmCount30d === 0
                ? "Asset sin alarmas en 30 días."
                : "Todas las alarmas resueltas."}
            </div>
          ) : (
            <div className={styles.list}>
              {openAlarms.map((al) => (
                <AlarmCard key={al.id} alarm={al} />
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Alarmas tab · all alarms for the asset, grouped by status
// ═══════════════════════════════════════════════════════════════

async function AlarmasTab({ assetId }: { assetId: string }) {
  // Seguridad module: only show alarms with SEGURIDAD domain.
  // Conducción alarms (harsh driving patterns, etc.) live in
  // the future /conduccion module.
  const all = await getAlarmsByAsset(assetId, {
    limit: 100,
    domain: "SEGURIDAD",
  });

  if (all.length === 0) {
    return (
      <div className={styles.empty}>
        Este asset no tiene alarmas registradas.
      </div>
    );
  }

  const open = all.filter((a) => a.status === "OPEN");
  const attended = all.filter((a) => a.status === "ATTENDED");
  const closed = all.filter(
    (a) => a.status === "CLOSED" || a.status === "DISMISSED",
  );

  return (
    <div className={styles.alarmasTab}>
      {open.length > 0 && (
        <section className={styles.panel}>
          <SectionHeader title="Abiertas" count={open.length} />
          <div className={styles.list}>
            {open.map((a) => (
              <AlarmCard key={a.id} alarm={a} />
            ))}
          </div>
        </section>
      )}

      {attended.length > 0 && (
        <section className={styles.panel}>
          <SectionHeader title="Atendidas" count={attended.length} />
          <div className={styles.list}>
            {attended.map((a) => (
              <AlarmCard key={a.id} alarm={a} />
            ))}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <section className={styles.panel}>
          <SectionHeader title="Cerradas" count={closed.length} />
          <div className={styles.list}>
            {closed.map((a) => (
              <AlarmCard key={a.id} alarm={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Eventos tab · paginated + filtered list (Sub-lote 3.2)
// ═══════════════════════════════════════════════════════════════

async function EventosTab({
  assetId,
  sp,
}: {
  assetId: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const params = parseAssetEventsParams(sp);

  const result = await listEventsByAsset({
    assetId,
    type: params.eventType,
    severity: params.eventSeverity,
    page: params.eventPage,
    pageSize: 25,
  });

  return (
    <div className={styles.eventosTab}>
      <EventFilterBar assetId={assetId} current={params} />

      {result.rows.length === 0 ? (
        <div className={styles.empty}>
          {params.eventType || params.eventSeverity
            ? "No hay eventos que cumplan los filtros aplicados."
            : "Este asset no tiene eventos registrados."}
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
            buildAssetEventsHref(assetId, params, { eventPage: page })
          }
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  Devices tab · list of trackers installed on this vehicle
//  ─────────────────────────────────────────────────────────────
//  Shows IMEI, vendor/model, primary flag, last-seen and install
//  date. The "primary" device is the one whose positions feed the
//  live map · others may be redundancies (e.g. a second tracker
//  for theft-recovery use).
// ═══════════════════════════════════════════════════════════════

function DevicesTab({
  asset,
}: {
  asset: NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>;
}) {
  if (asset.devices.length === 0) {
    return (
      <div className={styles.empty}>
        Este vehículo no tiene dispositivos instalados.
      </div>
    );
  }

  return (
    <section className={styles.panel}>
      <SectionHeader
        title="Dispositivos"
        count={asset.devices.length}
      />
      <div className={styles.devicesTableWrap}>
        <table className={styles.devicesTable}>
          <thead>
            <tr>
              <th className={styles.devTh}>IMEI</th>
              <th className={styles.devTh}>Vendor / Modelo</th>
              <th className={styles.devTh}>Rol</th>
              <th className={styles.devTh}>Última conexión</th>
              <th className={styles.devTh}>Instalado</th>
            </tr>
          </thead>
          <tbody>
            {asset.devices.map((d: any) => (
              <tr key={d.id} className={styles.devRow}>
                <td className={styles.devTd}>
                  <span className={styles.mono}>{d.imei}</span>
                </td>
                <td className={styles.devTd}>
                  <span className={styles.devVendor}>{d.vendor}</span>
                  <span className={styles.devModel}>{d.model}</span>
                </td>
                <td className={styles.devTd}>
                  {d.isPrimary ? (
                    <span className={styles.primaryPill}>Primario</span>
                  ) : (
                    <span className={styles.dim}>Secundario</span>
                  )}
                </td>
                <td className={styles.devTd}>
                  {d.lastSeenAt ? (
                    <span className={styles.dim}>
                      {formatRelativeAr(new Date(d.lastSeenAt))}
                    </span>
                  ) : (
                    <span className={styles.dim}>—</span>
                  )}
                </td>
                <td className={styles.devTd}>
                  <span className={styles.dim}>
                    {formatDateAr(new Date(d.installedAt))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDateAr(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
}

function formatRelativeAr(d: Date): string {
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `hace ${sec} seg`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `hace ${dd} d`;
  return formatDateAr(d);
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// ═══════════════════════════════════════════════════════════════
//  Mapa tab · day route mini-map + day stats + replay link
// ═══════════════════════════════════════════════════════════════

async function MapaTab({ assetId }: { assetId: string }) {
  const dayMap = await getAssetDayMap(assetId);
  if (!dayMap) {
    return (
      <div className={styles.empty}>
        No fue posible cargar el mapa de este vehículo.
      </div>
    );
  }
  return <AssetMapTab assetId={assetId} dayMap={dayMap} />;
}

// ═══════════════════════════════════════════════════════════════
//  Histórico tab (E5-B) · listado de viajes del vehículo
//  ─────────────────────────────────────────────────────────────
//  Usa la TripsTable global filtrada por assetId. Sin filter bar
//  ni KPI strip propia (la 360 ya tiene KPI strip en 30d arriba).
//  Rango fijo a últimos 30 días · selector de fechas se agrega en
//  un lote propio si el usuario lo necesita.
//
//  Sort URL-driven: ?tab=historico&sort=...&dir=...
//  El TripsTable acepta un buildSortHref custom para que los
//  clicks en headers de sort se queden en esta página y no
//  rebote a /seguimiento/viajes.
//
//  Nota: listTrips() actualmente itera Position desde la UI ·
//  deuda preexistente conocida (refactor → Trip persistido en
//  un lote dedicado). Reuso como está, no agrego violación nueva.
// ═══════════════════════════════════════════════════════════════

async function HistoricoTab({
  assetId,
  sp,
}: {
  assetId: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  // Default range · últimos 30 días anclados al "hoy" demo
  // (consistente con la KPI strip de la 360 que también usa 30d).
  const today = new Date("2026-04-26T12:00:00.000Z");
  const fromDate = ymd(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));
  const toDate = ymd(today);

  const sortBits = parseAssetHistoricoSort(sp);
  const sortParams = {
    fromDate,
    toDate,
    assetIds: [assetId],
    groupIds: [],
    personIds: [],
    sort: sortBits.sort,
    sortDir: sortBits.sortDir,
  };

  const trips = await listTrips({
    fromDate,
    toDate,
    assetIds: [assetId],
  });

  if (trips.length === 0) {
    return (
      <div className={styles.empty}>
        Este vehículo no registra viajes en los últimos 30 días.
      </div>
    );
  }

  return (
    <div className={styles.historicoTab}>
      <TripsTable
        trips={trips}
        sortParams={sortParams}
        buildSortHref={(current, override) =>
          buildAssetHistoricoHref(assetId, current, override)
        }
      />
    </div>
  );
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
