"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import {
  METRIC_LABELS,
  type ActivityMetric,
  type ActivityPivot,
  type ActivityPreset,
} from "@/lib/queries/activity";
import { buildActivityUrl, type ActivityUrlState } from "@/lib/url-activity";
import { PeriodSelector } from "@/components/maxtracker/activity/PeriodSelector";
import { MetricSelector } from "@/components/maxtracker/activity/MetricSelector";
import styles from "./ReportesClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  ReportesClient · grilla pivoteada assets × días
//  ─────────────────────────────────────────────────────────────
//  Estructura:
//    ┌─ Toolbar · period selector + metric selector + export ──┐
//    ├─ Tabla pivot · header sticky (días) · 1 fila por asset ─┤
//    │   Vehículo │ Patente │ ... days ... │ Total              │
//    │   con heatmap por celda (intensidad por valor / max)    │
//    └─ Footer · totales por día + grand total ────────────────┘
//
//  Performance: la tabla es virtual-scroll-friendly via overflow,
//  pero como tenemos ~30 vehículos no hace falta windowing aún.
//  Cuando crezca a 1000+ usamos react-virtual.
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/seguimiento/reportes";

interface Props {
  pivot: ActivityPivot;
  preset: ActivityPreset;
  customFrom: string | null;
  customTo: string | null;
}

export function ReportesClient({
  pivot,
  preset,
  customFrom,
  customTo,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const urlState: ActivityUrlState = {
    preset,
    customFrom,
    customTo,
    metric: pivot.metric,
    compare: false,
  };

  function navigate(override: Parameters<typeof buildActivityUrl>[2]) {
    const href = buildActivityUrl(BASE_PATH, urlState, override);
    startTransition(() => router.push(href));
  }

  // Compute max value per column · used for heatmap intensity.
  // We avoid using grand-max because it would wash out columns
  // with naturally smaller values. Per-day max is more useful.
  const maxByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of pivot.days) {
      let max = 0;
      for (const r of pivot.rows) {
        const v = r.byDay[d] ?? 0;
        if (v > max) max = v;
      }
      m[d] = max || 1; // avoid /0
    }
    return m;
  }, [pivot]);

  function exportCsv() {
    const rows: string[] = [];
    rows.push(buildCsvHeader(pivot));
    for (const r of pivot.rows) {
      rows.push(buildCsvRow(r, pivot));
    }
    rows.push(buildCsvTotal(pivot));
    const bom = "\uFEFF";
    const blob = new Blob([bom + rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename(pivot);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <PeriodSelector
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onChange={(next) =>
            navigate({
              preset: next.preset,
              customFrom: next.customFrom,
              customTo: next.customTo,
            })
          }
        />
        <div className={styles.toolbarSpacer} />
        <MetricSelector
          value={pivot.metric}
          onChange={(m) => navigate({ metric: m })}
        />
        <button
          type="button"
          className={styles.exportBtn}
          onClick={exportCsv}
          title="Exportar a CSV"
        >
          <Download size={13} />
          <span>Exportar CSV</span>
        </button>
      </div>

      {/* ── Header info ─────────────────────────────────────── */}
      <div className={styles.summary}>
        <span className={styles.summaryLabel}>Métrica:</span>
        <span className={styles.summaryValue}>{pivot.metricLabel}</span>
        <span className={styles.summaryDot}>·</span>
        <span className={styles.summaryLabel}>Período:</span>
        <span className={styles.summaryValue}>
          {formatDateRange(pivot.period.from, pivot.period.to)} ·{" "}
          {pivot.period.dayCount} día{pivot.period.dayCount !== 1 ? "s" : ""}
        </span>
        <span className={styles.summaryDot}>·</span>
        <span className={styles.summaryLabel}>Total:</span>
        <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>
          {formatNumber(pivot.grandTotal, pivot.metric)}
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.thSticky}`}>Vehículo</th>
              <th className={styles.th}>Patente</th>
              <th className={styles.th}>Grupo</th>
              {pivot.days.map((d) => (
                <th
                  key={d}
                  className={`${styles.th} ${styles.alignRight} ${
                    isWeekend(d) ? styles.thWeekend : ""
                  }`}
                  title={d}
                >
                  {formatDayHeader(d)}
                </th>
              ))}
              <th
                className={`${styles.th} ${styles.alignRight} ${styles.thTotal}`}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {pivot.rows.length === 0 ? (
              <tr>
                <td colSpan={pivot.days.length + 4} className={styles.empty}>
                  Sin datos para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              pivot.rows.map((r) => (
                <tr key={r.assetId} className={styles.row}>
                  <td className={`${styles.td} ${styles.tdSticky}`}>
                    <Link
                      href={`/gestion/vehiculos/${r.assetId}`}
                      className={styles.assetLink}
                    >
                      {r.assetName}
                    </Link>
                  </td>
                  <td className={styles.td}>
                    {r.assetPlate ? (
                      <span className={styles.plate}>{r.assetPlate}</span>
                    ) : (
                      <span className={styles.dim}>—</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {r.groupName ? (
                      <span className={styles.group}>{r.groupName}</span>
                    ) : (
                      <span className={styles.dim}>—</span>
                    )}
                  </td>
                  {pivot.days.map((d) => {
                    const v = r.byDay[d] ?? 0;
                    const maxD = maxByDay[d] ?? 1;
                    const intensity = bucket(v / maxD);
                    return (
                      <td
                        key={d}
                        className={`${styles.td} ${styles.tdValue} ${
                          isWeekend(d) ? styles.tdWeekend : ""
                        }`}
                        data-intensity={intensity}
                      >
                        <span className={styles.cellValue}>
                          {v === 0 ? (
                            <span className={styles.zero}>—</span>
                          ) : (
                            formatNumber(v, pivot.metric)
                          )}
                        </span>
                      </td>
                    );
                  })}
                  <td
                    className={`${styles.td} ${styles.tdTotal} ${styles.alignRight}`}
                  >
                    <strong>{formatNumber(r.total, pivot.metric)}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {pivot.rows.length > 0 && (
            <tfoot>
              <tr className={styles.footRow}>
                <td className={`${styles.tdFoot} ${styles.tdSticky}`}>
                  <strong>Total</strong>
                </td>
                <td className={styles.tdFoot} />
                <td className={styles.tdFoot} />
                {pivot.days.map((d) => (
                  <td
                    key={d}
                    className={`${styles.tdFoot} ${styles.alignRight} ${
                      isWeekend(d) ? styles.tdWeekend : ""
                    }`}
                  >
                    <strong>
                      {formatNumber(pivot.dayTotals[d] ?? 0, pivot.metric)}
                    </strong>
                  </td>
                ))}
                <td
                  className={`${styles.tdFoot} ${styles.tdTotal} ${styles.alignRight}`}
                >
                  <strong>
                    {formatNumber(pivot.grandTotal, pivot.metric)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function formatNumber(v: number, metric: ActivityMetric): string {
  if (metric === "distanceKm" || metric === "fuelLiters") {
    return v.toLocaleString("es-AR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: v % 1 === 0 ? 0 : 1,
    });
  }
  if (metric === "maxSpeedKmh") {
    return Math.round(v).toLocaleString("es-AR");
  }
  if (metric === "activeMin" || metric === "idleMin") {
    return formatMinutes(v);
  }
  return Math.round(v).toLocaleString("es-AR");
}

function formatMinutes(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatDayHeader(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

function isWeekend(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return false;
  // AR-local · Date.UTC + offset
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

function bucket(ratio: number): 0 | 1 | 2 | 3 | 4 {
  if (ratio <= 0) return 0;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

function formatDateRange(from: Date, toExclusive: Date): string {
  const arOffset = 3 * 60 * 60 * 1000;
  const fromLocal = new Date(from.getTime() - arOffset);
  const toLocal = new Date(toExclusive.getTime() - arOffset - 1);
  const fStr = `${pad(fromLocal.getUTCDate())}/${pad(fromLocal.getUTCMonth() + 1)}/${fromLocal.getUTCFullYear()}`;
  const tStr = `${pad(toLocal.getUTCDate())}/${pad(toLocal.getUTCMonth() + 1)}/${toLocal.getUTCFullYear()}`;
  return `${fStr} → ${tStr}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ── CSV building ─────────────────────────────────────────────

function csvFilename(pivot: ActivityPivot): string {
  const arOffset = 3 * 60 * 60 * 1000;
  const f = new Date(pivot.period.from.getTime() - arOffset);
  const t = new Date(pivot.period.to.getTime() - arOffset - 1);
  const stamp = `${f.getUTCFullYear()}${pad(f.getUTCMonth() + 1)}${pad(f.getUTCDate())}-${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`;
  return `actividad-${pivot.metric}-${stamp}.csv`;
}

function csvEsc(s: string): string {
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvHeader(pivot: ActivityPivot): string {
  const cols = ["Vehículo", "Patente", "Grupo", ...pivot.days, "Total"];
  return cols.map(csvEsc).join(";");
}

function buildCsvRow(
  r: ActivityPivot["rows"][number],
  pivot: ActivityPivot,
): string {
  const cells: string[] = [
    csvEsc(r.assetName),
    csvEsc(r.assetPlate ?? ""),
    csvEsc(r.groupName ?? ""),
  ];
  for (const d of pivot.days) {
    const v = r.byDay[d] ?? 0;
    cells.push(formatNumberForCsv(v, pivot.metric));
  }
  cells.push(formatNumberForCsv(r.total, pivot.metric));
  return cells.join(";");
}

function buildCsvTotal(pivot: ActivityPivot): string {
  const cells: string[] = ["Total", "", ""];
  for (const d of pivot.days) {
    const v = pivot.dayTotals[d] ?? 0;
    cells.push(formatNumberForCsv(v, pivot.metric));
  }
  cells.push(formatNumberForCsv(pivot.grandTotal, pivot.metric));
  return cells.join(";");
}

/** CSV usa coma decimal AR · sin separador de miles · sin formato de h/m */
function formatNumberForCsv(v: number, metric: ActivityMetric): string {
  if (metric === "distanceKm" || metric === "fuelLiters") {
    return v.toFixed(1).replace(".", ",");
  }
  if (metric === "maxSpeedKmh") {
    return String(Math.round(v));
  }
  return String(Math.round(v));
}
