"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Map as MapIcon, List } from "lucide-react";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import { PageHeader } from "@/components/maxtracker/ui";
import { InfractionSeverityFilterChips } from "@/components/maxtracker/infractions/InfractionSeverityFilter";
import {
  InfractionHeatmap,
} from "@/components/maxtracker/infractions/InfractionHeatmap";
import { InfractionDetailPanel } from "@/components/maxtracker/infractions/InfractionDetailPanel";
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

const BASE_PATH = "/conduccion/infracciones";

const SEVERITY_LABELS: Record<InfractionSeverityFilter, string> = {
  LEVE: "Leve",
  MEDIA: "Media",
  GRAVE: "Grave",
};

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

  return (
    <div className={styles.wrap}>
      <PageHeader
        variant="module"
        title="Infracciones"
        subtitle="Excesos de velocidad detectados · filtrables, georreferenciables, descartables"
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
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Inicio</th>
                  <th>Severidad</th>
                  <th>Vehículo</th>
                  <th>Conductor</th>
                  <th className={styles.cellRight}>Pico / Vmax</th>
                  <th className={styles.cellRight}>Exceso</th>
                  <th className={styles.cellRight}>Duración</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {props.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.empty}>
                      No se registraron infracciones para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  props.rows.map((r) => (
                    <tr
                      key={r.id}
                      className={styles.row}
                      onClick={() => setSelected(r)}
                    >
                      <td className={styles.timeCell}>
                        {new Date(r.startedAt).toLocaleString("es-AR", {
                          timeZone: "America/Argentina/Buenos_Aires",
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <span
                          className={styles.sevBadge}
                          style={{
                            color: SEVERITY_COLORS[r.severity],
                            borderColor: SEVERITY_COLORS[r.severity],
                          }}
                        >
                          {SEVERITY_LABELS[r.severity]}
                        </span>
                      </td>
                      <td>
                        <span className={styles.assetCell}>
                          <span className={styles.assetName}>{r.assetName}</span>
                          {r.assetPlate && (
                            <span className={styles.assetPlate}>{r.assetPlate}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        {r.personName ?? (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                      <td className={styles.cellRight}>
                        <strong>{Math.round(r.peakSpeedKmh)}</strong>
                        <span className={styles.muted}> / {r.vmaxKmh}</span>
                      </td>
                      <td
                        className={styles.cellRight}
                        style={{ color: SEVERITY_COLORS[r.severity], fontFamily: "ui-monospace" }}
                      >
                        +{Math.round(r.maxExcessKmh)}
                      </td>
                      <td className={styles.cellRight}>
                        {formatDurationShort(r.durationSec)}
                      </td>
                      <td>
                        <ChevronRight size={14} className={styles.muted} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
                {props.total.toLocaleString("es-AR")} infracciones
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
        <InfractionHeatmap points={props.heatPoints} height={650} />
      )}

      <InfractionDetailPanel
        infraction={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function formatDurationShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}min`;
  return `${m}m ${s}s`;
}
