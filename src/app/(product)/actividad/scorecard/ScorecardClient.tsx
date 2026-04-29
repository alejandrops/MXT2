"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  type AnalysisGranularity,
  type DriversMultiMetricData,
  type ScopeFilters,
} from "@/lib/queries";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import {
  DataTable,
  ExportMenu,
  PageHeader,
  granularityToPeriod,
  type ColumnDef,
} from "@/components/maxtracker/ui";
import { downloadCsv, csvFilename } from "@/lib/utils/csv";
import styles from "./ScorecardClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  ScorecardClient · ranking de seguridad por conductor
//  ─────────────────────────────────────────────────────────────
//  Refactor L1.C · cambios desde la versión anterior:
//    · Usa <DataTable> compartido (era tabla custom)
//    · Usa <PageHeader> compartido
//    · downloadCsv compartido (era reimplementación)
//    · SIN medallas oro/plata/bronce (Tufte · chartjunk)
//    · SIN icono User en cada fila (Tufte · chartjunk)
//    · Score chip con radius mínimo (era pill)
//    · Sort-by-score nativo de DataTable
// ═══════════════════════════════════════════════════════════════

const BASE_PATH = "/actividad/scorecard";

interface Props {
  data: DriversMultiMetricData;
}

interface RankedDriver {
  personId: string;
  personName: string;
  score: number;
  km: number;
  events: number;
  speeding: number;
  critical: number;
  vmax: number;
  breakdown: { label: string; pts: number }[];
}

export function ScorecardClient({ data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function buildHref(over: {
    g?: AnalysisGranularity;
    d?: string | null;
    scope?: ScopeFilters;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? data.granularity;
    const d = over.d === null ? null : over.d ?? data.anchorIso;
    const scope = over.scope ?? data.appliedScope;

    if (g !== "month-days") params.set("g", g);

    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(
      todayLocal.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
    if (d && d !== todayIso) params.set("d", d);
    if (scope.groupIds?.length) params.set("grp", scope.groupIds.join(","));
    if (scope.vehicleTypes?.length)
      params.set("type", scope.vehicleTypes.join(","));
    if (scope.personIds?.length)
      params.set("driver", scope.personIds.join(","));
    if (scope.search) params.set("q", scope.search);

    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function nav(over: Parameters<typeof buildHref>[0]) {
    startTransition(() => router.push(buildHref(over)));
  }

  function setScope(scope: ScopeFilters) {
    nav({ scope });
  }

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(
    todayLocal.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const isAnchorToday = data.anchorIso === todayIso;

  // ── Cálculo del score ──────────────────────────────────────
  const ranked: RankedDriver[] = data.rows.map((r) => {
    const km = r.metrics.distanceKm.value;
    const events = r.metrics.eventCount.value;
    const speeding = r.metrics.speedingCount.value;
    const critical = r.metrics.highEventCount.value;
    const vmax = r.metrics.maxSpeedKmh.value;
    const warnings = Math.max(0, events - critical);

    let score = 100;
    const breakdown: { label: string; pts: number }[] = [];

    if (speeding > 0) {
      const pts = -Math.min(20, speeding * 1);
      score += pts;
      breakdown.push({ label: `${Math.round(speeding)} excesos`, pts });
    }
    if (critical > 0) {
      const pts = -Math.min(30, critical * 3);
      score += pts;
      breakdown.push({ label: `${Math.round(critical)} críticos`, pts });
    }
    if (warnings > 0) {
      const pts = -Math.min(15, warnings * 1);
      score += pts;
      breakdown.push({ label: `${Math.round(warnings)} warnings`, pts });
    }
    if (vmax > 130) {
      score -= 10;
      breakdown.push({ label: `vmax ${Math.round(vmax)}km/h`, pts: -10 });
    } else if (vmax > 110) {
      score -= 5;
      breakdown.push({ label: `vmax ${Math.round(vmax)}km/h`, pts: -5 });
    }
    if (km > 0) {
      const ratio = (speeding / km) * 100;
      if (ratio >= 1) {
        const pts = -Math.min(10, Math.round(ratio));
        score += pts;
        breakdown.push({ label: `${ratio.toFixed(1)} exc/100km`, pts });
      }
    }
    score = Math.max(0, Math.min(100, score));

    return {
      personId: r.personId,
      personName: r.personName,
      score,
      km,
      events,
      speeding,
      critical,
      vmax,
      breakdown,
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  // ── CSV export · usa util compartido ───────────────────────
  function exportCsv() {
    downloadCsv({
      filename: csvFilename(`scorecard-${data.anchorIso}`),
      headers: [
        "Pos",
        "Conductor",
        "Score",
        "Km",
        "Eventos",
        "Excesos",
        "Críticos",
        "Vmax",
      ],
      rows: ranked.map((r, i) => [
        String(i + 1),
        r.personName,
        String(r.score),
        r.km.toFixed(1).replace(".", ","),
        String(Math.round(r.events)),
        String(Math.round(r.speeding)),
        String(Math.round(r.critical)),
        String(Math.round(r.vmax)),
      ]),
    });
  }

  // ── Columns para DataTable ─────────────────────────────────
  const columns: ColumnDef<RankedDriver & { _idx: number }>[] = [
    {
      key: "pos",
      label: "#",
      align: "right",
      sortable: false,
      render: (r) => <span className={styles.posNum}>{r._idx + 1}</span>,
    },
    {
      key: "name",
      label: "Conductor",
      sticky: true,
      sortValue: (r) => r.personName,
      render: (r) => (
        <Link
          href={`/objeto/conductor/${r.personId}`}
          className={styles.personLink}
        >
          {r.personName}
        </Link>
      ),
    },
    {
      key: "score",
      label: "Score",
      align: "right",
      sortValue: (r) => r.score,
      render: (r) => {
        const tier =
          r.score >= 90
            ? "high"
            : r.score >= 70
              ? "mid"
              : r.score >= 50
                ? "low"
                : "critical";
        return (
          <span
            className={`${styles.scoreChip} ${
              tier === "high"
                ? styles.scoreHigh
                : tier === "mid"
                  ? styles.scoreMid
                  : tier === "low"
                    ? styles.scoreLow
                    : styles.scoreCritical
            }`}
          >
            {r.score}
          </span>
        );
      },
    },
    {
      key: "breakdown",
      label: "Penalizaciones",
      sortable: false,
      minWidth: 280,
      render: (r) =>
        r.breakdown.length === 0 ? (
          <span className={styles.dim}>—</span>
        ) : (
          <span className={styles.breakdownList}>
            {r.breakdown.map((b, j) => (
              <span key={j} className={styles.breakdownItem}>
                <AlertTriangle size={9} />
                {b.label}{" "}
                <span className={styles.breakdownPts}>{b.pts}</span>
              </span>
            ))}
          </span>
        ),
    },
    {
      key: "km",
      label: "Km",
      align: "right",
      numeric: true,
      sortValue: (r) => r.km,
      render: (r) => Math.round(r.km).toLocaleString("es-AR"),
    },
    {
      key: "events",
      label: "Eventos",
      align: "right",
      numeric: true,
      sortValue: (r) => r.events,
      render: (r) => Math.round(r.events).toLocaleString("es-AR"),
    },
    {
      key: "speeding",
      label: "Excesos",
      align: "right",
      numeric: true,
      sortValue: (r) => r.speeding,
      render: (r) => Math.round(r.speeding).toLocaleString("es-AR"),
    },
    {
      key: "critical",
      label: "Críticos",
      align: "right",
      numeric: true,
      sortValue: (r) => r.critical,
      render: (r) => Math.round(r.critical).toLocaleString("es-AR"),
    },
    {
      key: "vmax",
      label: "Vmax",
      align: "right",
      numeric: true,
      sortValue: (r) => r.vmax,
      render: (r) => Math.round(r.vmax).toLocaleString("es-AR"),
    },
  ];

  const rowsWithIdx = ranked.map((r, _idx) => ({ ...r, _idx }));

  return (
    <>
      <PageHeader
        variant="module"
        title="Driver scorecard"
        subtitle={`${data.periodLabel} · ${data.periodSubLabel} · ${ranked.length} ${
          ranked.length === 1 ? "conductor" : "conductores"
        }`}
        actions={
          <ExportMenu
            onExportCsv={exportCsv}
            printPeriod={granularityToPeriod(data.granularity)}
          />
        }
      />

      <div className={styles.toolbar}>
        <PeriodNavigator
          granularity={data.granularity}
          prevAnchor={data.prevAnchorIso}
          nextAnchor={data.nextAnchorIso}
          isToday={isAnchorToday}
          onChangeGranularity={(g) => nav({ g })}
          onChangeAnchor={(d) => nav({ d })}
        />
      </div>

      <ScopeFiltersBar
        scope={data.appliedScope}
        available={data.scope}
        rowCount={ranked.length}
        onChange={setScope}
      />

      <div className={styles.tableContainer}>
        <DataTable
          columns={columns}
          rows={rowsWithIdx}
          rowKey={(r) => r.personId}
          density="normal"
          emptyMessage="Sin conductores con actividad para los filtros aplicados."
        />
      </div>
    </>
  );
}
