"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Map as MapIcon, List } from "lucide-react";
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
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Severidad</th>
                  <th>Vehículo</th>
                  <th>Conductor</th>
                  <th>Ubicación</th>
                  <th className={styles.cellRight}>Velocidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {props.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.empty}>
                      No se registraron eventos para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  props.rows.map((r) => {
                    const colorMap: Record<Severity, string> = {
                      LOW: "#64748b",
                      MEDIUM: "#f59e0b",
                      HIGH: "#ea580c",
                      CRITICAL: "#dc2626",
                    };
                    return (
                      <tr
                        key={r.id}
                        className={styles.row}
                        onClick={() => setSelectedEvent(r)}
                      >
                        <td className={styles.timeCell}>
                          {new Date(r.occurredAt).toLocaleString("es-AR", {
                            timeZone: "America/Argentina/Buenos_Aires",
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <span className={styles.typeCell}>
                            <span
                              className={styles.typeDot}
                              style={{ background: getEventColor(r.type) }}
                            />
                            {getEventLabel(r.type)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={styles.sevBadge}
                            style={{
                              color: colorMap[r.severity],
                              borderColor: colorMap[r.severity],
                            }}
                          >
                            {SEVERITY_LABELS[r.severity]}
                          </span>
                        </td>
                        <td>
                          <span className={styles.assetCell}>
                            <span className={styles.assetName}>
                              {r.assetName}
                            </span>
                            {r.assetPlate && (
                              <span className={styles.assetPlate}>
                                {r.assetPlate}
                              </span>
                            )}
                          </span>
                        </td>
                        <td>
                          {r.personName ?? (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td>
                          {r.lat && r.lng ? (
                            <span className={styles.coordsMono}>
                              {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
                            </span>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td className={styles.cellRight}>
                          {r.speedKmh !== null && r.speedKmh !== undefined
                            ? `${Math.round(r.speedKmh)} km/h`
                            : "—"}
                        </td>
                        <td>
                          <ChevronRight
                            size={14}
                            className={styles.muted}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {props.pageCount > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={props.page <= 1}
                onClick={() => navTo(buildHref({ page: props.page - 1 }))}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo}>
                Página {props.page} de {props.pageCount} ·{" "}
                {props.total.toLocaleString("es-AR")} eventos
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={props.page >= props.pageCount}
                onClick={() => navTo(buildHref({ page: props.page + 1 }))}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
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
