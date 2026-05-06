"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Map as MapIcon, List } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/maxtracker/ui/DataTable";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { PageHeader } from "@/components/maxtracker/ui";
import { EventHeatmap, type HeatPoint } from "@/components/maxtracker/events/EventHeatmap";
import {
  TimestampCell,
  VehicleCell,
  DriverCell,
  SeverityBadge,
  LocationCell,
} from "@/components/maxtracker/cells";
import { StatusBadge, type AlarmStatusValue } from "@/components/maxtracker/alarms/StatusBadge";
import { AlarmTypeCell, alarmTypeLabel } from "@/components/maxtracker/alarms/AlarmTypeCell";
import { AlarmDetailPanel } from "@/components/maxtracker/alarms/AlarmDetailPanel";
import type {
  AnalysisGranularity,
  ScopeFilters as ScopeFiltersType,
} from "@/lib/queries";
import styles from "./AlarmsClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  AlarmsClient · S5-T5 · canónico
//  ─────────────────────────────────────────────────────────────
//  Reescritura de Alarmas como clon visual de Eventos. Reemplaza:
//    · KPI strip de status (4 tiles) → status como columna
//    · AlarmCard list → DataTable canónica
//    · AlarmFilterBar → PeriodNavigator + ScopeFiltersBar
//    · Lista vertical → tabla densa con tabs Lista/Heatmap
//    · Click → side panel canónico (AlarmDetailPanel)
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/seguridad/alarmas";

interface AlarmRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  triggeredAt: Date | string;
  attendedAt?: Date | string | null;
  closedAt?: Date | string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  asset: { id: string; name: string; plate: string | null };
  person: { id: string; firstName: string; lastName: string } | null;
}

interface Props {
  granularity: AnalysisGranularity;
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
  isAnchorToday: boolean;
  view: "lista" | "heatmap";
  scope: ScopeFiltersType;
  selectedStatus: AlarmStatusValue | null;
  available: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  rows: AlarmRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  heatPoints: HeatPoint[];
}

const STATUS_FILTERS: AlarmStatusValue[] = [
  "OPEN",
  "ATTENDED",
  "CLOSED",
  "DISMISSED",
];

export function AlarmsClient(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmRow | null>(null);

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    view?: "lista" | "heatmap";
    scope?: ScopeFiltersType;
    status?: AlarmStatusValue | null;
    page?: number;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? props.granularity;
    const d = over.d === null ? null : (over.d ?? props.anchorIso);
    const view = over.view ?? props.view;
    const scope = over.scope ?? props.scope;
    const status =
      over.status === null
        ? null
        : (over.status ?? props.selectedStatus ?? null);
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
    if (scope.personIds?.length)
      params.set("driver", scope.personIds.join(","));
    if (scope.search) params.set("q", scope.search);

    if (status) params.set("status", status);

    if (page > 1) params.set("page", page.toString());

    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function navTo(href: string) {
    startTransition(() => router.push(href));
  }

  // ── Columnas ──────────────────────────────────────────
  const columns: ColumnDef<AlarmRow>[] = [
    {
      key: "triggeredAt",
      label: "Disparo",
      sortable: false,
      render: (a) => (
        <TimestampCell iso={a.triggeredAt} variant="long" />
      ),
    },
    {
      key: "status",
      label: "Estado",
      sortable: false,
      render: (a) => <StatusBadge status={a.status as AlarmStatusValue} />,
    },
    {
      key: "type",
      label: "Tipo",
      sortable: false,
      render: (a) => <AlarmTypeCell type={a.type as any} compact />,
    },
    {
      key: "severity",
      label: "Severidad",
      sortable: false,
      render: (a) => <SeverityBadge level={a.severity as any} />,
    },
    {
      key: "asset",
      label: "Vehículo",
      sortable: false,
      render: (a) => (
        <VehicleCell
          asset={{ id: a.asset.id, name: a.asset.name, plate: a.asset.plate }}
        />
      ),
    },
    {
      key: "driver",
      label: "Conductor",
      sortable: false,
      render: (a) => (
        <DriverCell
          person={
            a.person
              ? {
                  id: a.person.id,
                  name: `${a.person.firstName} ${a.person.lastName}`.trim(),
                }
              : null
          }
        />
      ),
    },
    {
      key: "location",
      label: "Ubicación",
      sortable: false,
      render: (a) =>
        a.lat != null && a.lng != null ? (
          <LocationCell lat={a.lat} lng={a.lng} />
        ) : (
          <span className={styles.dim}>—</span>
        ),
    },
  ];

  return (
    <div className={styles.wrap}>
      <PageHeader
        variant="module"
        helpSlug="seguridad/alarmas"
        title="Alarmas"
        subtitle="Bandeja de alarmas · filtrable, exportable, georeferenciable"
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

      {/* Filtro por status · chips horizontales */}
      <div className={styles.statusFilterRow}>
        <span className={styles.statusFilterLabel}>Estado:</span>
        <button
          type="button"
          className={`${styles.statusChip} ${props.selectedStatus === null ? styles.statusChipActive : ""}`}
          onClick={() => navTo(buildHref({ status: null, page: 1 }))}
        >
          Todas
        </button>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.statusChip} ${props.selectedStatus === s ? styles.statusChipActive : ""}`}
            onClick={() => navTo(buildHref({ status: s, page: 1 }))}
          >
            <StatusBadge status={s} />
          </button>
        ))}
      </div>

      {props.view === "lista" ? (
        <DataTable<AlarmRow>
          columns={columns}
          rows={props.rows}
          rowKey={(a) => a.id}
          title="Alarmas"
          count={props.total}
          onRowClick={(a) => setSelectedAlarm(a)}
          selectedRowKey={selectedAlarm?.id ?? null}
          page={props.page}
          pageCount={props.pageCount}
          totalCount={props.total}
          pageSize={props.pageSize}
          onPageChange={(p) => navTo(buildHref({ page: p }))}
          exportFilename={`alarmas-${props.anchorIso}`}
          exportColumns={[
            {
              header: "Disparo",
              value: (a) => new Date(a.triggeredAt).toISOString(),
            },
            { header: "Estado", value: (a) => a.status },
            {
              header: "Tipo",
              value: (a) => alarmTypeLabel(a.type),
            },
            { header: "Severidad", value: (a) => a.severity },
            { header: "Vehículo", value: (a) => a.asset.name },
            { header: "Patente", value: (a) => a.asset.plate ?? "" },
            {
              header: "Conductor",
              value: (a) =>
                a.person
                  ? `${a.person.firstName} ${a.person.lastName}`.trim()
                  : "",
            },
            { header: "Latitud", value: (a) => a.lat ?? "" },
            { header: "Longitud", value: (a) => a.lng ?? "" },
            { header: "Notas", value: (a) => a.notes ?? "" },
          ]}
          emptyMessage="Sin alarmas en el período seleccionado."
        />
      ) : (
        <EventHeatmap points={props.heatPoints} height={650} />
      )}

      <AlarmDetailPanel
        alarm={selectedAlarm}
        onClose={() => setSelectedAlarm(null)}
      />
    </div>
  );
}
