"use client";

import { Printer } from "lucide-react";
import {
  sparklineRamp,
  sparklineBars,
  sparklineDots,
  tendency,
  tendencyLabel,
} from "@/lib/sparkline";
import {
  scoreZone,
  scoreZoneLabel,
  type ParsedPeriod,
} from "@/lib/conduccion/boletin-driver-text";
import type { DriverBoletinData } from "@/lib/queries/driver-boletin-data";
import styles from "./Boletin.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverBoletin · S5-E1 · Tufte + B&N first
//  ─────────────────────────────────────────────────────────────
//  Port directo del mockup v2 aprobado:
//    · Score 42px integrado al flujo (no tile aislado)
//    · Severidad codificada por símbolo (○ ◐ ●), no color
//    · Sparklines Unicode inline para evolución
//    · Líneas guía en chart anual (no bandas pintadas)
//    · Tendencias con texto explícito
//
//  Branches:
//    · Mensual · 4 secciones (Score+KPIs · Infracciones+Top3 ·
//      Evolución 4 semanas · Vehículos)
//    · Anual · 4 secciones (Score+KPIs · Distribución+TopMeses ·
//      Chart 12 meses · Comparativa vs año anterior)
//
//  CSS @page A4 · Cmd+P → PDF nativo del browser
// ═══════════════════════════════════════════════════════════════

const MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

interface Props {
  data: DriverBoletinData;
  period: ParsedPeriod;
  folio: string;
  uniqueId: string;
  lead: string;
  generatedAtIso: string;
  generatedBy: string;
}

export function DriverBoletin({
  data,
  period,
  folio,
  lead,
  generatedAtIso,
  generatedBy,
}: Props) {
  return (
    <>
      {/* Botón flotante de imprimir · solo screen */}
      <button
        type="button"
        className={styles.printButton}
        onClick={() => window.print()}
      >
        <Printer size={14} />
        <span>Guardar como PDF</span>
      </button>

      <div className={styles.page}>
        {/* ── Header editorial ───────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.kicker}>Maxtracker · Conducción</div>
          <div className={styles.folio}>{folio}</div>
        </div>

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            {period.kind === "monthly"
              ? `Boletín mensual de ${data.driver.fullName}`
              : `Boletín anual de ${data.driver.fullName}`}
          </h1>
          <div className={styles.subtitle}>
            <strong>{period.label}</strong> · {data.driver.accountName}
          </div>
        </div>

        <div className={styles.lead}>{lead}</div>

        {/* ── 01 · Calificación + KPIs ─────────────────── */}
        <SectionHeader
          num="01"
          title={
            period.kind === "monthly"
              ? "Calificación y volumen"
              : "Calificación y volumen anual"
          }
        />

        <ScoreLine
          score={data.summary.score}
          prevScore={data.prev.score}
          period={period}
          kpis={getKpis(data, period)}
        />

        {/* ── 02 · Infracciones ────────────────────────── */}
        <SectionHeader
          num="02"
          title={period.kind === "monthly" ? "Infracciones" : "Infracciones del año"}
          summary={getInfractionsSummary(data)}
        />

        <DistributionStack
          leve={data.infractions.leve}
          media={data.infractions.media}
          grave={data.infractions.grave}
          total={data.infractions.total}
        />

        {data.infractions.topThree.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <table className={styles.compactTable}>
              <thead>
                <tr>
                  <th></th>
                  <th>
                    {period.kind === "monthly"
                      ? "Top 3 más graves del mes"
                      : "Top 3 más graves del año"}
                  </th>
                  <th className={styles.right}>Pico</th>
                  <th className={styles.right}>Vmax</th>
                  <th className={styles.right}>Exceso</th>
                </tr>
              </thead>
              <tbody>
                {data.infractions.topThree.map((inf) => (
                  <tr key={inf.id}>
                    <td className={styles.sevPrefix}>
                      {inf.severity === "GRAVE"
                        ? "●"
                        : inf.severity === "MEDIA"
                          ? "◐"
                          : "○"}
                    </td>
                    <td>{formatInfractionLine(inf)}</td>
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
          </div>
        )}

        {/* ── 03 · Evolución ───────────────────────────── */}
        {period.kind === "monthly" ? (
          <MonthlyEvolutionSection data={data} />
        ) : (
          <AnnualEvolutionSection data={data} />
        )}

        {/* ── 04 · Vehículos (mensual) o Comparativa (anual) ── */}
        {period.kind === "monthly" ? (
          <VehiclesSection vehicles={data.vehicles} />
        ) : (
          <ComparativeSection data={data} />
        )}

        {/* ── Footer ──────────────────────────────────── */}
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
//  Score + KPI line · score 42px (decisión usuario)
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
            ? "Score · seguridad"
            : "Score · promedio anual"}
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

function getKpis(data: DriverBoletinData, period: ParsedPeriod): KpiSpec[] {
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
  const horasPrev = data.prev.activeMin
    ? Math.round(data.prev.activeMin / 60)
    : null;
  const hoursTrend = makeTrendText(horas, horasPrev, period, "abs", "h");

  if (period.kind === "monthly") {
    return [
      { label: "Distancia", value: km, unit: "km", trend: kmTrend },
      { label: "Viajes", value: String(data.summary.tripCount), trend: tripsTrend },
      { label: "En ruta", value: String(horas), unit: "h", trend: hoursTrend },
      {
        label: "Vehículos",
        value: String(data.summary.uniqueAssetsCount),
        trend: "manejados",
      },
    ];
  }

  // Anual · 4to KPI es Infracciones (delta vs año anterior)
  const infTrend = makeTrendText(
    data.infractions.total,
    data.prev.infractionCount,
    period,
    "abs-inv", // menos es mejor · invertir signo en trend
  );
  return [
    { label: "Distancia", value: km, unit: "km", trend: kmTrend },
    { label: "Viajes", value: String(data.summary.tripCount), trend: tripsTrend },
    { label: "En ruta", value: String(horas), unit: "h", trend: hoursTrend },
    {
      label: "Infracciones",
      value: String(data.infractions.total),
      trend: infTrend,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
//  Distribution stack · símbolos + sparkline
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
  const barFor = (n: number) => "▆".repeat(Math.max(1, Math.round((n / total) * 16)));

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
      <span
        className={`${styles.distSpark} ${barClass ? styles[barClass] : ""}`}
      >
        {bar}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Monthly evolution · 3 sparklines inline
// ═══════════════════════════════════════════════════════════════

function MonthlyEvolutionSection({ data }: { data: DriverBoletinData }) {
  const scoreSpark = sparklineRamp(data.evolution.scoreSeries, 100);
  const scoreTendency = tendency(data.evolution.scoreSeries);
  const distanceSpark = sparklineBars(data.evolution.distanceSeries);
  const dotsSpark = data.daySpotlight ? sparklineDots(data.daySpotlight) : "";
  const totalKm = data.summary.distanceKm;
  const avgKmDay =
    data.summary.activeDays > 0
      ? Math.round(totalKm / data.summary.activeDays)
      : 0;
  const peakDayKm = Math.max(0, ...data.evolution.distanceSeries);
  const daysWithInf =
    data.daySpotlight?.filter((d) => d !== null).length ?? 0;
  const daysWithGrave =
    data.daySpotlight?.filter((d) => d === "G").length ?? 0;

  return (
    <>
      <SectionHeader num="03" title="Evolución de las semanas del mes" />
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
        <div className={styles.sparkLabel}>
          Distancia por semana
        </div>
        <div className={styles.sparkData}>
          <span className={styles.sparkGlyph}>{distanceSpark}</span>
          <span className={styles.sparkTrend}>
            media {formatKm(avgKmDay)} km/día activo · pico semana{" "}
            {Math.round(peakDayKm).toLocaleString("es-AR")} km
          </span>
        </div>
      </div>

      {dotsSpark && (
        <div className={styles.sparkBlock}>
          <div className={styles.sparkLabel}>Infracciones por día</div>
          <div className={styles.sparkData}>
            <span className={styles.sparkGlyph}>{dotsSpark}</span>
            <span className={styles.sparkTrend}>
              {daysWithInf === 0
                ? "ningún día con infracciones"
                : `${daysWithInf} días con infracciones${daysWithGrave > 0 ? ` · ${daysWithGrave} con grave` : ""}`}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Annual evolution · chart 12 meses con líneas guía (sin bandas)
// ═══════════════════════════════════════════════════════════════

function AnnualEvolutionSection({ data }: { data: DriverBoletinData }) {
  const scores = data.evolution.scoreSeries;
  const labels = data.evolution.labels;
  const monthsInGreen = data.monthsInGreen ?? 0;
  const monthsInYellow = scores.filter((s) => s >= 60 && s < 80).length;

  // Mejor y peor mes
  let bestIdx = 0,
    worstIdx = 0;
  for (let i = 1; i < scores.length; i++) {
    if ((scores[i] ?? 0) > (scores[bestIdx] ?? 0)) bestIdx = i;
    if ((scores[i] ?? 100) < (scores[worstIdx] ?? 100)) worstIdx = i;
  }
  const bestScore = scores[bestIdx] ?? 0;
  const worstScore = scores[worstIdx] ?? 0;
  const bestLabel = labels[bestIdx] ?? "—";
  const worstLabel = labels[worstIdx] ?? "—";
  const bestDistance = data.evolution.distanceSeries[bestIdx] ?? 0;
  const worstDistance = data.evolution.distanceSeries[worstIdx] ?? 0;

  // Coordenadas del SVG · viewBox 0 0 600 130
  // Y = 130 - (score * 1.2) ajustado · 100→10, 80→34, 60→58, 40→82
  const yFor = (s: number) => 130 - (s * 1.2) - (130 - 130);
  // Mejor · y = 130 - score*1.2 mapeado al rango visible:
  // Para score 100 → top (y=10), score 0 → bottom (y=130)
  // mejor: y = 10 + ((100 - s) / 100) * 72  (rango usable 10-82)
  const Y = (s: number) => 10 + ((100 - s) / 100) * 72;

  const xStep = 540 / 11; // 12 puntos · espacio entre primero y último
  const xFor = (i: number) => 60 + i * xStep;

  const polylinePoints = scores
    .map((s, i) => `${xFor(i)},${Y(s)}`)
    .join(" ");

  return (
    <>
      <SectionHeader
        num="03"
        title="Evolución · 12 meses"
        summary={`${monthsInGreen} meses verde · ${monthsInYellow} amarilla`}
      />

      <svg className={styles.annualChart} viewBox="0 0 600 130" preserveAspectRatio="none">
        {/* Líneas guía horizontales · NO bandas pintadas */}
        <line x1="40" y1="10"  x2="600" y2="10"  stroke="#e1e3e7" strokeWidth="0.5" strokeDasharray="2 3" />
        <line x1="40" y1="34"  x2="600" y2="34"  stroke="#1a1d23" strokeWidth="0.5" />
        <line x1="40" y1="58"  x2="600" y2="58"  stroke="#1a1d23" strokeWidth="0.5" strokeDasharray="3 2" />
        <line x1="40" y1="82"  x2="600" y2="82"  stroke="#e1e3e7" strokeWidth="0.5" strokeDasharray="2 3" />

        {/* Eje Y · labels */}
        <g fontFamily="IBM Plex Mono" fontSize="8" fill="#8b8f96">
          <text x="36" y="13" textAnchor="end">100</text>
          <text x="36" y="37" textAnchor="end">80</text>
          <text x="36" y="61" textAnchor="end">60</text>
          <text x="36" y="85" textAnchor="end">40</text>
        </g>

        {/* Etiquetas de zona · texto explícito (sustituye bandas) */}
        <g fontFamily="IBM Plex Sans" fontSize="8" fill="#1a1d23" fontWeight="500" letterSpacing="0.08em">
          <text x="600" y="32" textAnchor="end">UMBRAL ZONA VERDE</text>
          <text x="600" y="56" textAnchor="end">UMBRAL ZONA AMARILLA</text>
        </g>

        {/* Polilínea de score */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#1a1d23"
          strokeWidth="1.2"
        />

        {/* Markers · ○ verde / ● amarilla o roja · distinguibles en B&N */}
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

        {/* Eje X · meses */}
        <g fontFamily="IBM Plex Mono" fontSize="8" fill="#8b8f96" textAnchor="middle">
          {labels.map((m, i) => (
            <text key={m} x={xFor(i)} y={105}>
              {m}
            </text>
          ))}
        </g>

        {/* Score values */}
        <g fontFamily="IBM Plex Mono" fontSize="8.5" fill="#1a1d23" textAnchor="middle">
          {scores.map((s, i) => (
            <text key={i} x={xFor(i)} y={120}>
              {s}
            </text>
          ))}
        </g>

        {/* Leyenda mínima */}
        <g fontFamily="IBM Plex Mono" fontSize="8" fill="#4a4e56">
          <text x="40" y="128">○ verde   ● amarilla/roja</text>
        </g>
      </svg>

      <div className={styles.annualAside}>
        <div className={styles.monthBlock}>
          <div className={styles.monthLabel}>Mejor mes</div>
          <div className={styles.monthValue}>
            {bestLabel} · {bestScore}
          </div>
          <div className={styles.monthDetail}>
            distancia {formatKm(bestDistance)} km
          </div>
        </div>
        <div className={styles.monthBlock}>
          <div className={styles.monthLabel}>Peor mes</div>
          <div className={styles.monthValue}>
            {worstLabel} · {worstScore}
          </div>
          <div className={styles.monthDetail}>
            distancia {formatKm(worstDistance)} km
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Vehicles section (mensual)
// ═══════════════════════════════════════════════════════════════

function VehiclesSection({
  vehicles,
}: {
  vehicles: DriverBoletinData["vehicles"];
}) {
  if (vehicles.length === 0) {
    return null;
  }

  return (
    <>
      <SectionHeader
        num="04"
        title="Vehículos manejados"
        summary={`${vehicles.length} unidad${vehicles.length === 1 ? "" : "es"}`}
      />
      <div className={styles.vehiclesList}>
        {vehicles.map((v) => (
          <div key={v.id} className={styles.vehicleRow}>
            <span className={styles.vehicleName}>
              <strong>{v.name}</strong>
              {v.plate && <span className={styles.plate}>{v.plate}</span>}
            </span>
            <span className={styles.vehicleStat}>
              {formatKm(v.distanceKm)} km · {v.tripCount}{" "}
              {v.tripCount === 1 ? "viaje" : "viajes"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Comparative section (anual)
// ═══════════════════════════════════════════════════════════════

function ComparativeSection({ data }: { data: DriverBoletinData }) {
  const cur = data.summary;
  const prev = data.prev;
  const inf = data.infractions;
  const monthsGreen = data.monthsInGreen ?? 0;

  const rows = [
    {
      label: "Score promedio",
      cur: cur.score,
      prev: prev.score,
      sign: "abs",
      betterWhen: "higher" as const,
    },
    {
      label: "Distancia (km)",
      cur: Math.round(cur.distanceKm),
      prev: prev.distanceKm !== null ? Math.round(prev.distanceKm) : null,
      sign: "%",
      betterWhen: "higher" as const,
      caption: "más volumen",
    },
    {
      label: "Viajes",
      cur: cur.tripCount,
      prev: prev.tripCount,
      sign: "%",
      betterWhen: "higher" as const,
      caption: "más actividad",
    },
    {
      label: "Infracciones totales",
      cur: inf.total,
      prev: prev.infractionCount,
      sign: "%",
      betterWhen: "lower" as const,
    },
    {
      label: "Infracciones graves",
      cur: inf.grave,
      prev: null, // no tracked separately on prev · OK skip
      sign: "abs",
      betterWhen: "lower" as const,
    },
  ];

  return (
    <>
      <SectionHeader num="04" title={`Comparativa · año ${data.driver.fullName ? "anterior" : ""}`} />
      <table className={styles.compactTable}>
        <thead>
          <tr>
            <th>Indicador</th>
            <th className={styles.right}>Este año</th>
            <th className={styles.right}>Año anterior</th>
            <th className={styles.right}>Variación</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const delta =
              r.prev !== null && r.prev !== undefined ? r.cur - r.prev : null;
            const pct =
              r.prev && r.prev !== 0
                ? Math.round(((r.cur - r.prev) / r.prev) * 100)
                : null;
            const arrow =
              delta === null ? "" : delta > 0 ? "▲" : delta < 0 ? "▼" : "–";
            const better =
              delta === null
                ? null
                : (r.betterWhen === "higher" && delta > 0) ||
                    (r.betterWhen === "lower" && delta < 0)
                  ? "mejor"
                  : delta === 0
                    ? "—"
                    : "peor";
            const variationText =
              delta === null
                ? "—"
                : r.sign === "%" && pct !== null
                  ? `${arrow} ${delta > 0 ? "+" : ""}${pct}%`
                  : `${arrow} ${delta > 0 ? "+" : ""}${delta}`;
            return (
              <tr key={i}>
                <td>{r.label}</td>
                <td className={`${styles.right} ${styles.mono}`}>
                  <strong>{r.cur.toLocaleString("es-AR")}</strong>
                </td>
                <td
                  className={`${styles.right} ${styles.mono} ${styles.dim}`}
                >
                  {r.prev !== null && r.prev !== undefined
                    ? r.prev.toLocaleString("es-AR")
                    : "—"}
                </td>
                <td className={`${styles.right} ${styles.mono}`}>
                  {variationText}
                </td>
                <td className={styles.dim} style={{ fontSize: "9.5px" }}>
                  {r.caption ?? better ?? ""}
                </td>
              </tr>
            );
          })}
          <tr>
            <td>Meses en zona verde</td>
            <td className={`${styles.right} ${styles.mono}`}>
              <strong>{monthsGreen} / 12</strong>
            </td>
            <td className={`${styles.right} ${styles.mono} ${styles.dim}`}>
              —
            </td>
            <td className={`${styles.right} ${styles.mono}`}>—</td>
            <td className={styles.dim} style={{ fontSize: "9.5px" }}>
              {monthsGreen >= 8 ? "muy bueno" : monthsGreen >= 6 ? "bueno" : "a mejorar"}
            </td>
          </tr>
        </tbody>
      </table>
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
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " ART";
}

function getInfractionsSummary(data: DriverBoletinData): string {
  const total = data.infractions.total;
  const prev = data.prev.infractionCount;
  if (prev === null) return `${total} en el período`;
  const delta = total - prev;
  if (delta === 0) return `${total} · igual al período anterior`;
  if (delta < 0) return `${total} · ▼ ${-delta} vs período anterior`;
  return `${total} · ▲ ${delta} vs período anterior`;
}

function makeTrendText(
  cur: number,
  prev: number | null,
  period: ParsedPeriod,
  format: "abs" | "%" | "abs-inv",
  unit?: string,
): string {
  if (prev === null || prev === 0) return "";
  const delta = cur - prev;
  if (delta === 0) return `– sin cambio vs período anterior`;
  const arrow = delta > 0 ? "▲" : "▼";
  const periodLabel =
    period.kind === "monthly" ? "vs mes anterior" : "vs año anterior";
  // abs-inv · semánticamente "menos es mejor" pero el delta sigue siendo el real
  if (format === "%") {
    const pct = Math.round((delta / prev) * 100);
    return `${arrow} ${Math.abs(pct)}% ${periodLabel}`;
  }
  return `${arrow} ${Math.abs(delta)}${unit ? " " + unit : ""} ${periodLabel}`;
}

function formatInfractionLine(inf: {
  startedAtIso: string;
  startAddress: string | null;
}): string {
  const d = new Date(inf.startedAtIso);
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const hours = String(d.getUTCHours() - 3 < 0 ? d.getUTCHours() + 21 : d.getUTCHours() - 3).padStart(2, "0");
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  const datePart = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")} · ${hours}:${mins}`;
  const place = inf.startAddress ?? "—";
  return `${datePart} · ${place}`;
}
