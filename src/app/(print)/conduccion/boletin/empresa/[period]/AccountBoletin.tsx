"use client";

import { Printer } from "lucide-react";
import {
  sparklineRamp,
  sparklineBars,
  tendency,
  tendencyLabel,
} from "@/lib/sparkline";
import {
  scoreZone,
  scoreZoneLabel,
  type ParsedPeriod,
} from "@/lib/conduccion/boletin-driver-text";
import type { AccountBoletinData } from "@/lib/queries/account-boletin-data";
import styles from "./Boletin.module.css";

// ═══════════════════════════════════════════════════════════════
//  AccountBoletin · S5-E3 · Tufte + B&N first
//  ─────────────────────────────────────────────────────────────
//  Quinto y último nivel del Sistema Editorial Maxtracker.
//
//  Secciones:
//    01 · Score corporativo + KPIs
//    02 · Distribución de infracciones empresa
//    03 · Top 3 infracciones más graves del período
//    04 · Ranking de grupos · top 5 + bottom 5
//    05 · Panorama · scatter (km vs score) por grupo
//    06 · Evolución temporal
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: AccountBoletinData;
  period: ParsedPeriod;
  folio: string;
  lead: string;
  generatedAtIso: string;
  generatedBy: string;
}

export function AccountBoletin({
  data,
  period,
  folio,
  lead,
  generatedAtIso,
  generatedBy,
}: Props) {
  return (
    <>
      <button
        type="button"
        className={styles.printButton}
        onClick={() => window.print()}
      >
        <Printer size={14} />
        <span>Guardar como PDF</span>
      </button>

      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.kicker}>Maxtracker · Boletín ejecutivo</div>
          <div className={styles.folio}>{folio}</div>
        </div>

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            {period.kind === "monthly"
              ? `Boletín mensual de ${data.account.name}`
              : `Boletín anual de ${data.account.name}`}
          </h1>
          <div className={styles.subtitle}>
            <strong>{period.label}</strong>
            {" · "}
            {data.account.groupsCount} {data.account.groupsCount === 1 ? "grupo" : "grupos"}
            {" · "}
            {data.account.assetsCount} {data.account.assetsCount === 1 ? "vehículo" : "vehículos"}
          </div>
        </div>

        <div className={styles.lead}>{lead}</div>

        {/* ── 01 · Score corporativo ────────────────── */}
        <SectionHeader
          num="01"
          title={
            period.kind === "monthly"
              ? "Calificación corporativa y volumen"
              : "Calificación corporativa anual"
          }
        />
        <ScoreLine
          score={data.summary.score}
          prevScore={data.prev.score}
          period={period}
          kpis={getKpis(data, period)}
        />

        {/* ── 02 · Infracciones ─────────────────────── */}
        <SectionHeader
          num="02"
          title="Infracciones de la empresa"
          summary={`${data.infractions.total} en total · ${data.infractions.per100km} por 100 km`}
        />
        <DistributionStack
          leve={data.infractions.leve}
          media={data.infractions.media}
          grave={data.infractions.grave}
          total={data.infractions.total}
        />

        {/* ── 03 · Top 3 infracciones ──────────────── */}
        {data.topInfractions.length > 0 && (
          <>
            <SectionHeader
              num="03"
              title="Infracciones más graves del período"
            />
            <table className={styles.compactTable}>
              <thead>
                <tr>
                  <th></th>
                  <th>Conductor · Grupo · Vehículo</th>
                  <th className={styles.right}>Pico</th>
                  <th className={styles.right}>Vmax</th>
                  <th className={styles.right}>Exceso</th>
                </tr>
              </thead>
              <tbody>
                {data.topInfractions.map((inf) => (
                  <tr key={inf.id}>
                    <td className={styles.sevPrefix}>
                      {inf.severity === "GRAVE"
                        ? "●"
                        : inf.severity === "MEDIA"
                          ? "◐"
                          : "○"}
                    </td>
                    <td>
                      {formatInfractionLine(inf)}
                    </td>
                    <td className={`${styles.right} ${styles.mono}`}>
                      {inf.peakSpeedKmh}
                    </td>
                    <td
                      className={`${styles.right} ${styles.mono} ${styles.dim}`}
                    >
                      {inf.vmaxKmh}
                    </td>
                    <td className={`${styles.right} ${styles.mono}`}>
                      <strong>+{inf.maxExcessKmh}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── 04 · Ranking de grupos ───────────────── */}
        {data.summary.activeGroups > 0 && (
          <>
            <SectionHeader
              num="04"
              title="Ranking de grupos"
              summary={`${data.summary.activeGroups} ${data.summary.activeGroups === 1 ? "grupo activo" : "grupos activos"}`}
            />
            <div className={styles.rankingGrid}>
              <div>
                <div className={styles.rankingLabel}>Mejores 5 · por score</div>
                <GroupRankingTable rows={data.topGroups} />
              </div>
              {data.bottomGroups.length > 0 && (
                <div>
                  <div className={styles.rankingLabel}>
                    Peores 5 · requieren atención
                  </div>
                  <GroupRankingTable rows={data.bottomGroups} dim />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 05 · Scatter ──────────────────────────── */}
        {data.scatter.length > 0 && (
          <>
            <SectionHeader
              num="05"
              title="Panorama · grupos según distancia y score"
              summary="cada punto es un grupo de la empresa"
            />
            <ScatterChart points={data.scatter} />
          </>
        )}

        {/* ── 06 · Evolución ────────────────────────── */}
        {period.kind === "monthly" ? (
          <MonthlyEvolutionSection data={data} />
        ) : (
          <AnnualEvolutionSection data={data} />
        )}

        <div className={styles.footer}>
          <span>
            Generado por {generatedBy} · {formatGenerated(generatedAtIso)}
          </span>
          <span>{folio} · 1/1</span>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Section header
// ═══════════════════════════════════════════════════════════════

function SectionHeader({
  num,
  title,
  summary,
}: {
  num: string;
  title: string;
  summary?: string;
}) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionNum}>{num}</span>
      <span className={styles.sectionTitle}>{title}</span>
      {summary && <span className={styles.sectionSummary}>{summary}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Score + KPIs
// ═══════════════════════════════════════════════════════════════

interface KpiSpec {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
}

function ScoreLine({
  score,
  prevScore,
  period,
  kpis,
}: {
  score: number;
  prevScore: number | null;
  period: ParsedPeriod;
  kpis: KpiSpec[];
}) {
  const zone = scoreZone(score);
  const zoneLabel = scoreZoneLabel(zone);
  const delta = prevScore !== null ? score - prevScore : null;

  let trendText = "";
  if (delta !== null) {
    if (delta > 0)
      trendText = `▲ ${delta} vs ${period.kind === "monthly" ? "mes anterior" : "año anterior"} (${prevScore})`;
    else if (delta < 0)
      trendText = `▼ ${-delta} vs ${period.kind === "monthly" ? "mes anterior" : "año anterior"} (${prevScore})`;
    else trendText = `– sin cambio vs período anterior (${prevScore})`;
  }

  return (
    <div className={styles.scoreLine}>
      <div className={styles.scoreBlock}>
        <div className={styles.kpiLabel}>
          {period.kind === "monthly"
            ? "Score corporativo"
            : "Score corporativo · promedio anual"}
        </div>
        <div>
          <span className={styles.scoreNum}>{score}</span>
          <span className={styles.scoreOf}> / 100</span>
        </div>
        <div className={styles.scoreMeta}>
          {trendText && <span>{trendText}</span>}
          {trendText && <span> · </span>}
          <span>{zoneLabel}</span>
        </div>
      </div>

      <div className={styles.kpiFlex}>
        {kpis.map((k, i) => (
          <div key={i} className={styles.kpi}>
            <div className={styles.kpiLabel}>{k.label}</div>
            <div className={styles.kpiValue}>
              {k.value}
              {k.unit && <span className={styles.kpiUnit}> {k.unit}</span>}
            </div>
            {k.trend && <div className={styles.kpiTrend}>{k.trend}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function getKpis(
  data: AccountBoletinData,
  period: ParsedPeriod,
): KpiSpec[] {
  const km = formatKm(data.summary.distanceKm);
  const horas = Math.round(data.summary.activeMin / 60);
  const kmTrend = makeTrendText(
    data.summary.distanceKm,
    data.prev.distanceKm,
    period,
    "%",
  );
  const tripsTrend = makeTrendText(
    data.summary.tripCount,
    data.prev.tripCount,
    period,
    "abs",
  );

  return [
    { label: "Distancia", value: km, unit: "km", trend: kmTrend },
    { label: "Viajes", value: String(data.summary.tripCount), trend: tripsTrend },
    {
      label: "Conductores",
      value: String(data.summary.activeDrivers),
      trend: "activos",
    },
    {
      label: "Vehículos",
      value: String(data.summary.activeAssets),
      trend: `de ${data.account.assetsCount} totales`,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
//  Distribution
// ═══════════════════════════════════════════════════════════════

function DistributionStack({
  leve,
  media,
  grave,
  total,
}: {
  leve: number;
  media: number;
  grave: number;
  total: number;
}) {
  if (total === 0) {
    return (
      <div className={styles.emptyBlock}>
        Sin infracciones de velocidad en el período.
      </div>
    );
  }
  const pct = (n: number) => Math.round((n / total) * 100);
  const barFor = (n: number) =>
    "▆".repeat(Math.max(1, Math.round((n / total) * 16)));

  return (
    <div className={styles.distStack}>
      <Row symbol="○" symbolClass="leve" label="Leve" labelClass="leve" count={leve} pct={pct(leve)} bar={barFor(leve)} barClass="" />
      <Row symbol="◐" symbolClass="media" label="Media" labelClass="media" count={media} pct={pct(media)} bar={barFor(media)} barClass="media" />
      <Row symbol="●" symbolClass="grave" label="Grave" labelClass="grave" count={grave} pct={pct(grave)} bar={barFor(grave)} barClass="grave" />
    </div>
  );
}

function Row({
  symbol,
  symbolClass,
  label,
  labelClass,
  count,
  pct,
  bar,
  barClass,
}: {
  symbol: string;
  symbolClass: string;
  label: string;
  labelClass: string;
  count: number;
  pct: number;
  bar: string;
  barClass: string;
}) {
  return (
    <div className={styles.distRow}>
      <span className={`${styles.distSymbol} ${styles[symbolClass]}`}>
        {symbol}
      </span>
      <span className={`${styles.distLabel} ${styles[labelClass]}`}>{label}</span>
      <span className={styles.distCount}>
        {count} · {pct}%
      </span>
      <span className={`${styles.distSpark} ${barClass ? styles[barClass] : ""}`}>
        {bar}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Group Ranking Table
// ═══════════════════════════════════════════════════════════════

function GroupRankingTable({
  rows,
  dim,
}: {
  rows: AccountBoletinData["topGroups"];
  dim?: boolean;
}) {
  return (
    <table className={styles.compactTable}>
      <thead>
        <tr>
          <th>Grupo</th>
          <th className={styles.right}>Score</th>
          <th className={styles.right}>Km</th>
          <th className={styles.right}>Cond.</th>
          <th className={styles.right}>Inf.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.groupId}>
            <td className={dim ? styles.dim : ""}>{r.name}</td>
            <td className={`${styles.right} ${styles.mono}`}>
              <strong>{r.score}</strong>
            </td>
            <td className={`${styles.right} ${styles.mono} ${styles.dim}`}>
              {formatKm(r.distanceKm)}
            </td>
            <td className={`${styles.right} ${styles.mono} ${styles.dim}`}>
              {r.activeDrivers}
            </td>
            <td className={`${styles.right} ${styles.mono}`}>
              {r.infractionCount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Scatter chart (grupos)
// ═══════════════════════════════════════════════════════════════

function ScatterChart({
  points,
}: {
  points: AccountBoletinData["scatter"];
}) {
  if (points.length === 0) return null;

  const xMin = 40;
  const xMax = 570;
  const yMin = 10;
  const yMax = 170;

  const maxKm = Math.max(...points.map((p) => p.distanceKm), 1);
  const xFor = (km: number) => xMin + (km / maxKm) * (xMax - xMin);
  const yFor = (score: number) =>
    yMax - (Math.max(0, Math.min(100, score)) / 100) * (yMax - yMin);

  const y80 = yFor(80);
  const y60 = yFor(60);

  return (
    <svg
      className={styles.scatterChart}
      viewBox="0 0 600 200"
      preserveAspectRatio="none"
    >
      <line x1={xMin} y1={y80} x2={xMax} y2={y80} stroke="#1a1d23" strokeWidth="0.5" strokeDasharray="3 2" />
      <line x1={xMin} y1={y60} x2={xMax} y2={y60} stroke="#1a1d23" strokeWidth="0.5" strokeDasharray="3 2" />

      <g fontFamily="IBM Plex Mono" fontSize="8" fill="#8b8f96" textAnchor="end">
        <text x={xMin - 4} y={yFor(100) + 3}>100</text>
        <text x={xMin - 4} y={y80 + 3}>80</text>
        <text x={xMin - 4} y={y60 + 3}>60</text>
        <text x={xMin - 4} y={yFor(0) + 3}>0</text>
      </g>

      <g fontFamily="IBM Plex Sans" fontSize="8" fill="#1a1d23" fontWeight="500" letterSpacing="0.08em">
        <text x={xMax} y={y80 - 2} textAnchor="end">UMBRAL ZONA VERDE</text>
        <text x={xMax} y={y60 - 2} textAnchor="end">UMBRAL ZONA AMARILLA</text>
      </g>

      <line x1={xMin} y1={yFor(0)} x2={xMax} y2={yFor(0)} stroke="#e1e3e7" strokeWidth="0.5" />
      <g fontFamily="IBM Plex Mono" fontSize="8" fill="#8b8f96" textAnchor="middle">
        <text x={xMin} y={yFor(0) + 16}>0 km</text>
        <text x={(xMin + xMax) / 2} y={yFor(0) + 16}>{formatKm(maxKm / 2)} km</text>
        <text x={xMax} y={yFor(0) + 16}>{formatKm(maxKm)} km</text>
      </g>
      <text
        x={(xMin + xMax) / 2}
        y={yFor(0) + 30}
        fontFamily="IBM Plex Sans"
        fontSize="8"
        fill="#1a1d23"
        textAnchor="middle"
        letterSpacing="0.08em"
      >
        DISTANCIA RECORRIDA POR GRUPO EN EL PERÍODO
      </text>

      {points.map((p) => {
        const filled = p.score < 80;
        // Tamaño del punto por número de drivers · radio entre 3 y 8
        const r = Math.min(8, Math.max(3, 3 + p.activeDrivers * 0.8));
        return (
          <circle
            key={p.groupId}
            cx={xFor(p.distanceKm)}
            cy={yFor(p.score)}
            r={r}
            fill={filled ? "#1a1d23" : "#fff"}
            stroke="#1a1d23"
            strokeWidth="1.2"
            opacity={0.85}
          >
            <title>
              {p.name} · {p.score}/100 · {formatKm(p.distanceKm)} km · {p.activeDrivers} cond. · {p.infractionCount} inf.
            </title>
          </circle>
        );
      })}

      <text
        x={xMin}
        y={yFor(0) + 30}
        fontFamily="IBM Plex Mono"
        fontSize="8"
        fill="#4a4e56"
      >
        ○ verde  ● amarilla/roja  · tamaño = conductores activos
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Evolution sections
// ═══════════════════════════════════════════════════════════════

function MonthlyEvolutionSection({ data }: { data: AccountBoletinData }) {
  const scoreSpark = sparklineRamp(data.evolution.scoreSeries, 100);
  const scoreTendency = tendency(data.evolution.scoreSeries);
  const distanceSpark = sparklineBars(data.evolution.distanceSeries);

  return (
    <>
      <SectionHeader num="06" title="Evolución de la empresa · semanas del mes" />
      <div className={styles.sparkBlock}>
        <div className={styles.sparkLabel}>Score por semana</div>
        <div className={styles.sparkData}>
          {data.evolution.scoreSeries.map((s, i) => (
            <span key={i}>
              {data.evolution.labels[i]} <strong>{s}</strong>
            </span>
          ))}
          <span className={styles.sparkGlyph}>{scoreSpark}</span>
          <span className={styles.sparkTrend}>
            {tendencyLabel(scoreTendency)}
          </span>
        </div>
      </div>

      <div className={styles.sparkBlock}>
        <div className={styles.sparkLabel}>Distancia por semana</div>
        <div className={styles.sparkData}>
          <span className={styles.sparkGlyph}>{distanceSpark}</span>
          <span className={styles.sparkTrend}>
            total {formatKm(data.summary.distanceKm)} km en el período
          </span>
        </div>
      </div>
    </>
  );
}

function AnnualEvolutionSection({ data }: { data: AccountBoletinData }) {
  const scores = data.evolution.scoreSeries;
  const labels = data.evolution.labels;
  const monthsInGreen = data.monthsInGreen ?? 0;
  const monthsInYellow = scores.filter((s) => s >= 60 && s < 80).length;

  let bestIdx = 0;
  let worstIdx = 0;
  for (let i = 1; i < scores.length; i++) {
    if ((scores[i] ?? 0) > (scores[bestIdx] ?? 0)) bestIdx = i;
    if ((scores[i] ?? 100) < (scores[worstIdx] ?? 100)) worstIdx = i;
  }
  const bestLabel = labels[bestIdx] ?? "—";
  const worstLabel = labels[worstIdx] ?? "—";
  const bestScore = scores[bestIdx] ?? 0;
  const worstScore = scores[worstIdx] ?? 0;
  const bestDistance = data.evolution.distanceSeries[bestIdx] ?? 0;
  const worstDistance = data.evolution.distanceSeries[worstIdx] ?? 0;

  const Y = (s: number) => 10 + ((100 - s) / 100) * 72;
  const xStep = 540 / 11;
  const xFor = (i: number) => 60 + i * xStep;
  const polylinePoints = scores.map((s, i) => `${xFor(i)},${Y(s)}`).join(" ");

  return (
    <>
      <SectionHeader
        num="06"
        title="Evolución anual · 12 meses"
        summary={`${monthsInGreen} meses verde · ${monthsInYellow} amarilla`}
      />
      <svg className={styles.annualChart} viewBox="0 0 600 130" preserveAspectRatio="none">
        <line x1="40" y1="10"  x2="600" y2="10"  stroke="#e1e3e7" strokeWidth="0.5" strokeDasharray="2 3" />
        <line x1="40" y1="34"  x2="600" y2="34"  stroke="#1a1d23" strokeWidth="0.5" />
        <line x1="40" y1="58"  x2="600" y2="58"  stroke="#1a1d23" strokeWidth="0.5" strokeDasharray="3 2" />
        <line x1="40" y1="82"  x2="600" y2="82"  stroke="#e1e3e7" strokeWidth="0.5" strokeDasharray="2 3" />
        <g fontFamily="IBM Plex Mono" fontSize="8" fill="#8b8f96">
          <text x="36" y="13" textAnchor="end">100</text>
          <text x="36" y="37" textAnchor="end">80</text>
          <text x="36" y="61" textAnchor="end">60</text>
          <text x="36" y="85" textAnchor="end">40</text>
        </g>
        <g fontFamily="IBM Plex Sans" fontSize="8" fill="#1a1d23" fontWeight="500" letterSpacing="0.08em">
          <text x="600" y="32" textAnchor="end">UMBRAL ZONA VERDE</text>
          <text x="600" y="56" textAnchor="end">UMBRAL ZONA AMARILLA</text>
        </g>
        <polyline points={polylinePoints} fill="none" stroke="#1a1d23" strokeWidth="1.2" />
        {scores.map((s, i) => {
          const filled = s < 80;
          return (
            <circle
              key={i}
              cx={xFor(i)}
              cy={Y(s)}
              r={2.8}
              fill={filled ? "#1a1d23" : "#fff"}
              stroke="#1a1d23"
              strokeWidth="1.2"
            />
          );
        })}
        <g fontFamily="IBM Plex Mono" fontSize="8" fill="#8b8f96" textAnchor="middle">
          {labels.map((m, i) => (
            <text key={m} x={xFor(i)} y={105}>{m}</text>
          ))}
        </g>
        <g fontFamily="IBM Plex Mono" fontSize="8.5" fill="#1a1d23" textAnchor="middle">
          {scores.map((s, i) => (
            <text key={i} x={xFor(i)} y={120}>{s}</text>
          ))}
        </g>
      </svg>

      <div className={styles.annualAside}>
        <div className={styles.monthBlock}>
          <div className={styles.monthLabel}>Mejor mes</div>
          <div className={styles.monthValue}>{bestLabel} · {bestScore}</div>
          <div className={styles.monthDetail}>distancia {formatKm(bestDistance)} km</div>
        </div>
        <div className={styles.monthBlock}>
          <div className={styles.monthLabel}>Peor mes</div>
          <div className={styles.monthValue}>{worstLabel} · {worstScore}</div>
          <div className={styles.monthDetail}>distancia {formatKm(worstDistance)} km</div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function formatKm(n: number): string {
  return Math.round(n).toLocaleString("es-AR").replace(/,/g, "\u00A0");
}

function formatGenerated(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " ART"
  );
}

function makeTrendText(
  cur: number,
  prev: number | null,
  period: ParsedPeriod,
  format: "abs" | "%",
): string {
  if (prev === null || prev === 0) return "";
  const delta = cur - prev;
  if (delta === 0) return "– sin cambio vs período anterior";
  const arrow = delta > 0 ? "▲" : "▼";
  const periodLabel =
    period.kind === "monthly" ? "vs mes anterior" : "vs año anterior";
  if (format === "%") {
    const pct = Math.round((delta / prev) * 100);
    return `${arrow} ${Math.abs(pct)}% ${periodLabel}`;
  }
  return `${arrow} ${Math.abs(delta)} ${periodLabel}`;
}

function formatInfractionLine(inf: {
  startedAtIso: string;
  driverName: string;
  groupName: string;
  assetName: string;
}): string {
  const d = new Date(inf.startedAtIso);
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const hours = String(
    d.getUTCHours() - 3 < 0 ? d.getUTCHours() + 21 : d.getUTCHours() - 3,
  ).padStart(2, "0");
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  const datePart = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")} · ${hours}:${mins}`;
  return `${datePart} · ${inf.driverName} · ${inf.groupName} · ${inf.assetName}`;
}
