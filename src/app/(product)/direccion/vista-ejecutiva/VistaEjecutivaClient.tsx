"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type {
  ActivityMetric,
  DriversMultiMetricData,
  FleetAnalysisData,
  FleetMultiMetricData,
} from "@/lib/queries";
import {
  KpiCard,
  PageHeader,
  RankingList,
  type RankingItem,
} from "@/components/maxtracker/ui";
import styles from "./VistaEjecutivaClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  VistaEjecutivaClient · Dirección > Vista ejecutiva
//  ─────────────────────────────────────────────────────────────
//  Refactor L1.C · ahora usa componentes compartidos:
//    · <PageHeader variant="module">
//    · <KpiCard size="lg"> · 4 cards
//    · <RankingList> · 2 listas (vehículos, conductores)
//      · cada item con href al Libro del Objeto (Fase 2)
//
//  Anomalías quedan inline porque tienen estructura propia
//  (icon direccional + descripción + z) que no encaja en
//  RankingList. Si después aparece <AnomalyList> lo refactoreamos.
// ═══════════════════════════════════════════════════════════════

interface Props {
  analysis: FleetAnalysisData;
  fleetMulti: FleetMultiMetricData;
  driversMulti: DriversMultiMetricData;
}

export function VistaEjecutivaClient({
  analysis,
  fleetMulti,
  driversMulti,
}: Props) {
  const totalKm = fleetMulti.totals.distanceKm.value;
  const totalKmDelta = fleetMulti.totals.distanceKm.deltaPct;
  const totalActive = fleetMulti.totals.activeMin.value;
  const totalActiveDelta = fleetMulti.totals.activeMin.deltaPct;
  const totalEvents = fleetMulti.totals.eventCount.value;
  const totalEventsDelta = fleetMulti.totals.eventCount.deltaPct;
  const fleetSize = fleetMulti.rows.length;
  const activeFleet = fleetMulti.rows.filter(
    (r) => r.metrics.distanceKm.value > 0,
  ).length;

  // ── Top 5 vehículos (por km) ──────────────────────────────
  const top5Vehicles: RankingItem[] = [...fleetMulti.rows]
    .sort((a, b) => b.metrics.distanceKm.value - a.metrics.distanceKm.value)
    .slice(0, 5)
    .map((r) => ({
      id: r.assetId,
      name: r.assetName,
      value: r.metrics.distanceKm.value,
      href: `/objeto/vehiculo/${r.assetId}`,
    }));

  // ── Top 5 conductores · score simplificado ────────────────
  const driversWithScore = driversMulti.rows.map((r) => {
    let score = 100;
    score -= Math.min(20, Math.round(r.metrics.speedingCount.value));
    score -= Math.min(30, Math.round(r.metrics.highEventCount.value) * 3);
    if (r.metrics.maxSpeedKmh.value > 130) score -= 10;
    else if (r.metrics.maxSpeedKmh.value > 110) score -= 5;
    return {
      ...r,
      score: Math.max(0, Math.min(100, score)),
    };
  });
  const top5Drivers: RankingItem[] = [...driversWithScore]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => ({
      id: r.personId,
      name: r.personName,
      value: r.score,
      href: `/objeto/conductor/${r.personId}`,
      renderValue: () => (
        <span
          className={`${styles.scoreInline} ${
            r.score >= 90
              ? styles.scoreHigh
              : r.score >= 70
                ? styles.scoreMid
                : styles.scoreLow
          }`}
        >
          {r.score}
        </span>
      ),
    }));

  const top3Anomalies = analysis.anomalies.slice(0, 3);

  return (
    <div className={styles.dash}>
      <PageHeader
        variant="module"
        title="Vista ejecutiva"
        subtitle={`${analysis.periodLabel} · ${analysis.periodSubLabel}`}
        actions={
          <div className={styles.headerActions}>
            <Link href="/actividad/analisis" className={styles.headerLink}>
              Análisis →
            </Link>
            <Link href="/actividad/reportes" className={styles.headerLink}>
              Reportes →
            </Link>
            <Link href="/actividad/scorecard" className={styles.headerLink}>
              Scorecard →
            </Link>
          </div>
        }
      />

      <div className={styles.body}>
        <div className={styles.kpiGrid}>
          <KpiCard
            size="lg"
            label="Distancia total"
            value={fmtKm(totalKm)}
            unit="km"
            delta={totalKmDelta}
            deltaLabel="vs mes anterior"
          />
          <KpiCard
            size="lg"
            label="Horas activas"
            value={fmtH(totalActive)}
            unit="h"
            delta={totalActiveDelta}
            deltaLabel="vs mes anterior"
          />
          <KpiCard
            size="lg"
            label="Eventos"
            value={Math.round(totalEvents).toLocaleString("es-AR")}
            delta={totalEventsDelta}
            isReverseDelta
            deltaLabel="vs mes anterior"
          />
          <KpiCard
            size="lg"
            label="Flota activa"
            value={`${activeFleet} / ${fleetSize}`}
            unit="vehículos"
            delta={undefined}
          />
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Distancia por día</h2>
          <DailyBars trend={analysis.trend} />
        </section>

        <div className={styles.dualGrid}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Top 5 vehículos</h2>
              <Link
                href="/actividad/reportes?layout=metrics"
                className={styles.seeAll}
              >
                ver todos →
              </Link>
            </div>
            <RankingList
              items={top5Vehicles}
              formatValue={(v) => `${fmtKm(v)} km`}
              preSorted
              emptyMessage="Sin datos"
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Top 5 conductores</h2>
              <Link href="/actividad/scorecard" className={styles.seeAll}>
                scorecard →
              </Link>
            </div>
            <RankingList
              items={top5Drivers}
              formatValue={(v) => String(v)}
              preSorted
              showBars={false}
              emptyMessage="Sin actividad"
            />
          </section>
        </div>

        {top3Anomalies.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Anomalías destacadas</h2>
              <Link href="/actividad/analisis" className={styles.seeAll}>
                análisis completo →
              </Link>
            </div>
            <ul className={styles.anomalies}>
              {top3Anomalies.map((a) => (
                <li key={a.assetId} className={styles.anomalyItem}>
                  <span
                    className={`${styles.anomalyDir} ${
                      a.direction === "high"
                        ? styles.anomHigh
                        : styles.anomLow
                    }`}
                  >
                    {a.direction === "high" ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownRight size={12} />
                    )}
                  </span>
                  <Link
                    href={`/objeto/vehiculo/${a.assetId}`}
                    className={styles.anomalyName}
                  >
                    {a.assetName}
                  </Link>
                  <span className={styles.anomalyDesc}>
                    {a.direction === "high"
                      ? "muy por encima de su patrón habitual"
                      : "muy por debajo de su patrón habitual"}
                  </span>
                  <span className={styles.anomalyZ}>
                    z={a.zScore > 0 ? "+" : ""}
                    {a.zScore.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function DailyBars({ trend }: { trend: { value: number; label: string }[] }) {
  if (trend.length === 0) return <div className={styles.empty}>Sin datos</div>;
  const max = Math.max(0.001, ...trend.map((t) => t.value));
  const W = 1100,
    H = 100,
    padL = 30,
    padR = 8,
    padT = 8,
    padB = 22;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const barW = (innerW / trend.length) * 0.7;
  const gap = (innerW / trend.length) * 0.3;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={styles.barsSvg}
    >
      {trend.map((t, i) => {
        const x = padL + i * (innerW / trend.length) + gap / 2;
        const h = (t.value / max) * innerH;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} className={styles.bar} />
            {(i === 0 ||
              i === trend.length - 1 ||
              i === Math.floor(trend.length / 2)) && (
              <text
                x={x + barW / 2}
                y={padT + innerH + 14}
                textAnchor="middle"
                className={styles.barLbl}
              >
                {t.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function fmtKm(v: number): string {
  return v.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}
function fmtH(min: number): string {
  if (min <= 0) return "0";
  return Math.floor(min / 60).toLocaleString("es-AR");
}
