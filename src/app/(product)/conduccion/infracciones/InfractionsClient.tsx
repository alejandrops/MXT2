"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Map as MapIcon, List } from "lucide-react";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { PageHeader } from "@/components/maxtracker/ui";
import { DataTable, type ColumnDef } from "@/components/maxtracker/ui/DataTable";
import { InfractionSeverityFilterChips } from "@/components/maxtracker/infractions/InfractionSeverityFilter";
import { InfractionHeatmap } from "@/components/maxtracker/infractions/InfractionHeatmap";
import { InfractionDetailPanel } from "@/components/maxtracker/infractions/InfractionDetailPanel";
import {
  TimestampCell,
  VehicleCell,
  DriverCell,
  SeverityBadge,
  SpeedCell,
  DurationCell,
} from "@/components/maxtracker/cells";
import { formatTimestamp } from "@/lib/format";
import type {
  AnalysisGranularity,
  ScopeFilters as ScopeFiltersType,
} from "@/lib/queries";
import type {
  InfractionListRow,
  InfractionHeatPoint,
  InfractionSeverityFilter,
} from "@/lib/queries/infractions-list";
import styles from "./InfractionsClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  InfractionsClient · S5-T1 · migrado a DataTable v2
//  ─────────────────────────────────────────────────────────────
//  La tabla custom interna de S4-L3c se reemplaza por DataTable
//  v2 con el patrón unificado "Posiciones". Cambios:
//    · Headers uppercase pequeños en gris
//    · Tipografía monoespaciada en columnas numéricas
//    · Click-row → side panel via onRowClick
//    · selectedRowKey marca la fila abierta con tinte azul
//    · Header del bloque con título "Infracciones" + count
//    · Botón export CSV nativo
//    · Paginación delegada al DataTable (page/pageCount/totalCount)
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/conduccion/infracciones";

const SEVERITY_COLORS: Record<InfractionSeverityFilter, string> = {
  LEVE: "#f59e0b",
  MEDIA: "#ea580c",
  GRAVE: "#dc2626",
};

interface Props {
  granularity: AnalysisGranularity;
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
  isAnchorToday: boolean;
  view: "lista" | "heatmap";
  scope: ScopeFiltersType;
  selectedSeverities: InfractionSeverityFilter[];
  available: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  rows: InfractionListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  heatPoints: InfractionHeatPoint[];
}

export function InfractionsClient(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<InfractionListRow | null>(null);

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    view?: "lista" | "heatmap";
    scope?: ScopeFiltersType;
    severities?: InfractionSeverityFilter[];
    page?: number;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? props.granularity;
    const d = over.d === null ? null : (over.d ?? props.anchorIso);
    const view = over.view ?? props.view;
    const scope = over.scope ?? props.scope;
    const severities = over.severities ?? props.selectedSeverities;
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

    if (severities.length > 0) params.set("sev", severities.join(","));

    if (page > 1) params.set("page", page.toString());

    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function navTo(href: string) {
    startTransition(() => router.push(href));
  }

  // ── Definición de columnas con cells canónicos S5-T2 ──────
  const columns: ColumnDef<InfractionListRow>[] = [
    {
      key: "startedAt",
      label: "Inicio",
      mono: true,
      sortable: false,
      render: (r) => <TimestampCell iso={r.startedAt} />,
    },
    {
      key: "severity",
      label: "Severidad",
      sortable: false,
      render: (r) => <SeverityBadge level={r.severity} />,
    },
    {
      key: "vehicle",
      label: "Vehículo",
      sortable: false,
      render: (r) => (
        <VehicleCell
          asset={{
            id: r.assetId,
            name: r.assetName,
            plate: r.assetPlate,
          }}
        />
      ),
    },
    {
      key: "person",
      label: "Conductor",
      sortable: false,
      render: (r) => (
        <DriverCell
          person={
            r.personId && r.personName
              ? { id: r.personId, name: r.personName }
              : null
          }
        />
      ),
    },
    {
      key: "peakVmax",
      label: "Pico / Vmax",
      align: "right",
      mono: true,
      sortable: false,
      render: (r) => (
        <>
          <SpeedCell kmh={r.peakSpeedKmh} color={SEVERITY_COLORS[r.severity]} />
          <span style={{ color: "#9ca3af", marginLeft: 4 }}>
            / {r.vmaxKmh}
          </span>
        </>
      ),
    },
    {
      key: "excess",
      label: "Exceso",
      align: "right",
      mono: true,
      sortable: false,
      render: (r) => (
        <span
          style={{
            color: SEVERITY_COLORS[r.severity],
            fontFamily: "var(--m)",
          }}
        >
          +{Math.round(r.maxExcessKmh)}
        </span>
      ),
    },
    {
      key: "duration",
      label: "Duración",
      align: "right",
      mono: true,
      sortable: false,
      render: (r) => <DurationCell sec={r.durationSec} />,
    },
  ];

  return (
    <div className={styles.wrap}>
      <PageHeader
        variant="module"
        helpSlug="conduccion/infracciones"
        title="Infracciones"
        subtitle="Excesos de velocidad detectados · filtrables, georreferenciables, descartables"
      />

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

      <div className={styles.filterRow}>
        <InfractionSeverityFilterChips
          selected={props.selectedSeverities}
          onChange={(severities) =>
            navTo(buildHref({ severities, page: 1 }))
          }
        />
      </div>

      {props.view === "lista" ? (
        <DataTable
          columns={columns}
          rows={props.rows}
          rowKey={(r) => r.id}
          title="Infracciones"
          count={props.total}
          onRowClick={(r) => setSelected(r)}
          selectedRowKey={selected?.id ?? null}
          page={props.page}
          pageCount={props.pageCount}
          totalCount={props.total}
          pageSize={props.pageSize}
          onPageChange={(p) => navTo(buildHref({ page: p }))}
          exportFormats={["csv"]}
          exportFilename={`infracciones-${props.anchorIso}`}
          exportColumns={[
            {
              header: "Inicio",
              value: (r) => formatTimestamp(r.startedAt, "with-seconds"),
            },
            {
              header: "Severidad",
              value: (r) =>
                INFRACTION_SEVERITY_LABEL[r.severity] ?? r.severity,
            },
            { header: "Vehiculo", value: (r) => r.assetName },
            { header: "Patente", value: (r) => r.assetPlate ?? "" },
            { header: "Conductor", value: (r) => r.personName ?? "" },
            { header: "Pico (km/h)", value: (r) => Math.round(r.peakSpeedKmh) },
            { header: "Vmax (km/h)", value: (r) => r.vmaxKmh },
            { header: "Exceso (km/h)", value: (r) => Math.round(r.maxExcessKmh) },
            { header: "Duracion (s)", value: (r) => r.durationSec },
            {
              header: "Distancia (km)",
              value: (r) => (r.distanceMeters / 1000).toFixed(2),
            },
            { header: "Tipo de via", value: (r) => r.roadType },
          ]}
          emptyMessage="No se registraron infracciones para los filtros aplicados."
        />
      ) : (
        <InfractionHeatmap points={props.heatPoints} height={650} />
      )}

      <InfractionDetailPanel
        infraction={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// Labels para CSV export · capitaliza los enums del módulo de infracciones
const INFRACTION_SEVERITY_LABEL: Record<InfractionSeverityFilter, string> = {
  LEVE: "Leve",
  MEDIA: "Media",
  GRAVE: "Grave",
};
