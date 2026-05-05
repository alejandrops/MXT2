"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Map as MapIcon, List } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/maxtracker/ui/DataTable";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { PageHeader } from "@/components/maxtracker/ui";
import { EventHeatmap, type HeatPoint } from "@/components/maxtracker/events/EventHeatmap";
import { DayDetailPanel } from "@/components/maxtracker/days/DayDetailPanel";
import {
  VehicleCell,
  DriverCell,
  DistanceCell,
  DurationCell,
} from "@/components/maxtracker/cells";
import type {
  AnalysisGranularity,
  ScopeFilters as ScopeFiltersType,
} from "@/lib/queries";
import type { Day } from "@/lib/queries/trips-by-day";
import styles from "./TripsClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripsClient · S5-T3 · canónico
//  ─────────────────────────────────────────────────────────────
//  Reescrito desde cero como clon del EventsClient. La pantalla
//  ahora es indistinguible de Eventos e Infracciones:
//
//    · PageHeader con título y subtítulo
//    · Toolbar · PeriodNavigator + tabs Lista/Heatmap
//    · ScopeFiltersBar · grupos · tipos vehículo · conductor · search
//    · DataTable full-width o EventHeatmap
//    · Side panel canónico (DayDetailPanel) deslizable al click
//
//  Cambios vs versión anterior:
//    · Sin split layout 60/40 (lista + mapa lateral) · ahora la
//      lista usa todo el ancho. El mapa se ve solo dentro del
//      side panel cuando se selecciona un día.
//    · Sin TripsKpiStrip
//    · Sin TripsExportButton (Excel) · el menú export del
//      DataTable cubre CSV + XLSX
//    · Sin TripsFilterBar · usa los selectores canónicos
//    · Sin cap "Ver 20 más" · paginación normal page/pageSize
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/actividad/viajes";

interface Props {
  granularity: AnalysisGranularity;
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
  isAnchorToday: boolean;
  view: "lista" | "heatmap";
  scope: ScopeFiltersType;
  available: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  rows: Day[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  heatPoints: HeatPoint[];
}

export function TripsClient(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    view?: "lista" | "heatmap";
    scope?: ScopeFiltersType;
    page?: number;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? props.granularity;
    const d = over.d === null ? null : (over.d ?? props.anchorIso);
    const view = over.view ?? props.view;
    const scope = over.scope ?? props.scope;
    const page = over.page ?? props.page;

    if (g !== "month-days") params.set("g", g);

    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(
      todayLocal.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
    if (d && d !== todayIso) params.set("d", d);

    if (view !== "lista") params.set("view", view);

    if (scope.groupIds?.length) params.set("grp", scope.groupIds.join(","));
    if (scope.vehicleTypes?.length)
      params.set("type", scope.vehicleTypes.join(","));
    if (scope.personIds?.length) params.set("driver", scope.personIds.join(","));
    if (scope.search) params.set("q", scope.search);

    if (page > 1) params.set("page", page.toString());

    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function navTo(href: string) {
    startTransition(() => router.push(href));
  }

  // ── Columnas con cells canónicos ──────────────────────────
  const columns: ColumnDef<Day>[] = [
    {
      key: "day",
      label: "Día",
      sortable: false,
      render: (day) => (
        <span className={styles.dayCell}>{formatDay(day.dayIso)}</span>
      ),
    },
    {
      key: "asset",
      label: "Vehículo",
      sortable: false,
      render: (day) => (
        <VehicleCell
          asset={{
            id: day.assetId,
            name: day.assetName,
            plate: day.assetPlate,
          }}
        />
      ),
    },
    {
      key: "driver",
      label: "Conductor",
      sortable: false,
      render: (day) => (
        <DriverCell
          person={
            day.driverId && day.driverName
              ? { id: day.driverId, name: day.driverName }
              : null
          }
        />
      ),
    },
    {
      key: "distance",
      label: "Distancia",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) => <DistanceCell meters={day.totalDistanceKm * 1000} />,
    },
    {
      key: "tripCount",
      label: "Viajes",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) => day.tripCount,
    },
    {
      key: "stopCount",
      label: "Paradas",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) =>
        day.stopCount === 0 ? (
          <span className={styles.dim}>—</span>
        ) : (
          day.stopCount
        ),
    },
    {
      key: "drivingTime",
      label: "En ruta",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) => <DurationCell ms={day.totalDrivingMs} />,
    },
    {
      key: "events",
      label: "Eventos",
      align: "right",
      mono: true,
      sortable: false,
      render: (day) => {
        const { eventTotal, eventCritical } = countEvents(day);
        if (eventTotal === 0) return <span className={styles.dim}>—</span>;
        return (
          <>
            <span>{eventTotal}</span>
            {eventCritical > 0 && (
              <span className={styles.critical}> ({eventCritical}!)</span>
            )}
          </>
        );
      },
    },
  ];

  return (
    <div className={styles.wrap}>
      <PageHeader
        variant="module"
        title="Viajes"
        subtitle="Listado por día · vehículo · filtrable, exportable, georeferenciable"
      />

      {/* Toolbar · navegador período + tabs */}
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

      <ScopeFiltersBar
        scope={props.scope}
        available={props.available}
        rowCount={props.total}
        onChange={(next) => navTo(buildHref({ scope: next, page: 1 }))}
      />

      {props.view === "lista" ? (
        <DataTable<Day>
          columns={columns}
          rows={props.rows}
          rowKey={(d) => d.id}
          title="Viajes por día"
          count={props.total}
          onRowClick={(d) => setSelectedDay(d)}
          selectedRowKey={selectedDay?.id ?? null}
          page={props.page}
          pageCount={props.pageCount}
          totalCount={props.total}
          pageSize={props.pageSize}
          onPageChange={(p) => navTo(buildHref({ page: p }))}
          exportFilename={`viajes-${props.anchorIso}`}
          exportColumns={[
            { header: "Dia", value: (d) => d.dayIso },
            { header: "Vehiculo", value: (d) => d.assetName },
            { header: "Patente", value: (d) => d.assetPlate ?? "" },
            { header: "Conductor", value: (d) => d.driverName ?? "" },
            { header: "Distancia (km)", value: (d) => d.totalDistanceKm },
            { header: "Viajes", value: (d) => d.tripCount },
            { header: "Paradas", value: (d) => d.stopCount },
            {
              header: "En ruta (min)",
              value: (d) => Math.round(d.totalDrivingMs / 60000),
            },
            {
              header: "Eventos totales",
              value: (d) => countEvents(d).eventTotal,
            },
            {
              header: "Eventos criticos",
              value: (d) => countEvents(d).eventCritical,
            },
          ]}
          emptyMessage="Sin viajes en el período seleccionado."
        />
      ) : (
        <EventHeatmap points={props.heatPoints} height={650} />
      )}

      <DayDetailPanel
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function countEvents(day: Day): {
  eventTotal: number;
  eventCritical: number;
} {
  let eventTotal = 0;
  let eventCritical = 0;
  for (const item of day.items) {
    if (item.kind === "trip") {
      eventTotal += item.eventCount;
      eventCritical += item.highSeverityEventCount;
    }
  }
  return { eventTotal, eventCritical };
}

const DOW = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DOW[date.getUTCDay()]} ${String(d).padStart(2, "0")} ${MES[m - 1]}`;
}
