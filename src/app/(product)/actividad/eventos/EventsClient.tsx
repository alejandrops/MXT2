"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Map as MapIcon, List } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/maxtracker/ui/DataTable";
import type { EventType, Severity } from "@/types/domain";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { PageHeader } from "@/components/maxtracker/ui";
import { EventTypeFilter } from "@/components/maxtracker/events/EventTypeFilter";
import { SeverityFilter } from "@/components/maxtracker/events/SeverityFilter";
import { EventHeatmap, type HeatPoint } from "@/components/maxtracker/events/EventHeatmap";
import { EventDetailPanel } from "@/components/maxtracker/events/EventDetailPanel";
import { getEventColor, getEventLabel } from "@/lib/event-catalog";
import type {
  AnalysisGranularity,
  ScopeFilters as ScopeFiltersType,
} from "@/lib/queries";
import type { EventListRow } from "@/lib/queries/events-list";
import styles from "./EventsClient.module.css";

const BASE_PATH = "/actividad/eventos";

const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

interface Props {
  granularity: AnalysisGranularity;
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
  isAnchorToday: boolean;
  view: "lista" | "heatmap";
  scope: ScopeFiltersType;
  selectedTypes: EventType[];
  selectedSeverities: Severity[];
  available: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  rows: EventListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  heatPoints: HeatPoint[];
}

export function EventsClient(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedEvent, setSelectedEvent] = useState<EventListRow | null>(null);

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    view?: "lista" | "heatmap";
    scope?: ScopeFiltersType;
    types?: EventType[];
    severities?: Severity[];
    page?: number;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? props.granularity;
    const d = over.d === null ? null : (over.d ?? props.anchorIso);
    const view = over.view ?? props.view;
    const scope = over.scope ?? props.scope;
    const types = over.types ?? props.selectedTypes;
    const severities = over.severities ?? props.selectedSeverities;
    const page = over.page ?? props.page;

    if (g !== "month-days") params.set("g", g);

    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
    if (d && d !== todayIso) params.set("d", d);

    if (view !== "lista") params.set("view", view);

    if (scope.groupIds?.length) params.set("grp", scope.groupIds.join(","));
    if (scope.vehicleTypes?.length) params.set("type", scope.vehicleTypes.join(","));
    if (scope.personIds?.length) params.set("driver", scope.personIds.join(","));
    if (scope.search) params.set("q", scope.search);

    if (types.length > 0) params.set("ev", types.join(","));
    if (severities.length > 0) params.set("sev", severities.join(","));

    if (page > 1) params.set("page", page.toString());

    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function navTo(href: string) {
    startTransition(() => router.push(href));
  }


  return (
    <div className={styles.wrap}>
      <PageHeader
        variant="module"
        title="Eventos"
        subtitle="Listado de eventos de los vehículos · filtrable, exportable, georeferenciable"
      />

      {/* Toolbar superior · navegador período + tabs */}
      <div className={styles.toolbar}>
        <PeriodNavigator
          granularity={props.granularity}
          prevAnchor={props.prevAnchorIso}
          nextAnchor={props.nextAnchorIso}
          isToday={props.isAnchorToday}
          onChangeGranularity={(g) => navTo(buildHref({ g }))}
          onChangeAnchor={(d) => navTo(buildHref({ d }))}
        />

        <div className={styles.toolbarSpacer} />

        {/* Tabs Lista | Heatmap */}
        <div className={styles.viewTabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={props.view === "lista"}
            className={`${styles.viewTab} ${props.view === "lista" ? styles.viewTabActive : ""}`}
            onClick={() => navTo(buildHref({ view: "lista" }))}
          >
            <List size={13} />
            <span>Lista</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={props.view === "heatmap"}
            className={`${styles.viewTab} ${props.view === "heatmap" ? styles.viewTabActive : ""}`}
            onClick={() => navTo(buildHref({ view: "heatmap" }))}
          >
            <MapIcon size={13} />
            <span>Heatmap</span>
          </button>
        </div>
      </div>

      {/* Filtros · primera fila */}
      <ScopeFiltersBar
        scope={props.scope}
        available={props.available}
        rowCount={props.total}
        onChange={(next) => navTo(buildHref({ scope: next, page: 1 }))}
      />

      {/* Filtros · segunda fila · específicos de eventos */}
      <div className={styles.filterRow}>
        <EventTypeFilter
          selected={props.selectedTypes}
          onChange={(types) => navTo(buildHref({ types, page: 1 }))}
        />
        <SeverityFilter
          selected={props.selectedSeverities}
          onChange={(severities) =>
            navTo(buildHref({ severities, page: 1 }))
          }
        />
      </div>

      {/* Vista · Lista o Heatmap */}
      {props.view === "lista" ? (
        <DataTable<EventListRow>
          columns={[
            {
              key: "occurredAt",
              label: "Hora",
              mono: true,
              sortable: false,
              render: (r) =>
                new Date(r.occurredAt).toLocaleString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            },
            {
              key: "type",
              label: "Tipo",
              sortable: false,
              render: (r) => (
                <span className={styles.typeCell}>
                  <span
                    className={styles.typeDot}
                    style={{ background: getEventColor(r.type) }}
                  />
                  {getEventLabel(r.type)}
                </span>
              ),
            },
            {
              key: "severity",
              label: "Severidad",
              sortable: false,
              render: (r) => {
                const colorMap: Record<Severity, string> = {
                  LOW: "#64748b",
                  MEDIUM: "#f59e0b",
                  HIGH: "#ea580c",
                  CRITICAL: "#dc2626",
                };
                return (
                  <span
                    className={styles.sevBadge}
                    style={{
                      color: colorMap[r.severity],
                      borderColor: colorMap[r.severity],
                    }}
                  >
                    {SEVERITY_LABELS[r.severity]}
                  </span>
                );
              },
            },
            {
              key: "vehicle",
              label: "Vehículo",
              sortable: false,
              render: (r) => (
                <Link
                  href={`/objeto/vehiculo/${r.assetId}`}
                  className={styles.assetLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={styles.assetName}>{r.assetName}</span>
                  {r.assetPlate && (
                    <span className={styles.assetPlate}>{r.assetPlate}</span>
                  )}
                </Link>
              ),
            },
            {
              key: "person",
              label: "Conductor",
              sortable: false,
              render: (r) =>
                r.personName ? (
                  <span>{r.personName}</span>
                ) : (
                  <span className={styles.muted}>—</span>
                ),
            },
            {
              key: "location",
              label: "Ubicación",
              sortable: false,
              mono: true,
              render: (r) =>
                r.lat && r.lng ? (
                  <span>
                    {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
                  </span>
                ) : (
                  <span className={styles.muted}>—</span>
                ),
            },
            {
              key: "speedKmh",
              label: "Velocidad",
              align: "right",
              mono: true,
              sortable: false,
              render: (r) =>
                r.speedKmh !== null && r.speedKmh !== undefined
                  ? `${Math.round(r.speedKmh)} km/h`
                  : "—",
            },
          ]}
          rows={props.rows}
          rowKey={(r) => r.id}
          title="Eventos"
          count={props.total}
          onRowClick={(r) => setSelectedEvent(r)}
          selectedRowKey={selectedEvent?.id ?? null}
          page={props.page}
          pageCount={props.pageCount}
          totalCount={props.total}
          pageSize={props.pageSize}
          onPageChange={(p) => navTo(buildHref({ page: p }))}
          exportFormats={["csv"]}
          exportFilename={`eventos-${props.anchorIso}`}
          exportColumns={[
            {
              header: "Hora",
              value: (r) =>
                new Date(r.occurredAt).toLocaleString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                }),
            },
            { header: "Tipo", value: (r) => getEventLabel(r.type) },
            { header: "Severidad", value: (r) => SEVERITY_LABELS[r.severity] },
            { header: "Vehiculo", value: (r) => r.assetName },
            { header: "Patente", value: (r) => r.assetPlate ?? "" },
            { header: "Conductor", value: (r) => r.personName ?? "" },
            { header: "Latitud", value: (r) => r.lat ?? "" },
            { header: "Longitud", value: (r) => r.lng ?? "" },
            {
              header: "Velocidad (km/h)",
              value: (r) =>
                r.speedKmh !== null && r.speedKmh !== undefined
                  ? Math.round(r.speedKmh)
                  : "",
            },
          ]}
          emptyMessage="No se registraron eventos para los filtros aplicados."
        />
      ) : (
        <EventHeatmap points={props.heatPoints} height={650} />
      )}

      {/* Panel lateral · al hacer click en una fila */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
