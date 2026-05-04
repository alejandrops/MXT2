"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
  type TooltipProps,
} from "recharts";
import styles from "./PositionInGroupScatter.module.css";

// ═══════════════════════════════════════════════════════════════
//  PositionInGroupScatter · S1-L4b
//  ─────────────────────────────────────────────────────────────
//  Scatter plot reusable que muestra los peers de un grupo en 2
//  dimensiones · resalta el objeto activo del Libro.
//
//  Patrón visual (validado con PO):
//    · Punto activo · color marca, tamaño grande, label visible
//    · Resto del grupo · gris semi-transparente, label en hover
//    · Hover sobre cualquier punto · tooltip con datos del par
//
//  Props genéricas · funciona para vehículo / conductor / grupo
//  con la misma firma · solo cambian los fields que se mappean
//  a los ejes y los formatters.
// ═══════════════════════════════════════════════════════════════

export interface ScatterPoint {
  id: string;
  name: string;
  plate?: string | null;
  /** Eje X · ej. distanceKm, tripCount */
  x: number;
  /** Eje Y · ej. safetyScore, eventCount */
  y: number;
}

interface Props {
  points: ScatterPoint[];
  activeId: string;
  xLabel: string;
  yLabel: string;
  /** Formatter para mostrar valores en tooltip · default: toString */
  formatX?: (n: number) => string;
  formatY?: (n: number) => string;
  /** Etiqueta del eje X en tooltip · default: xLabel */
  xUnit?: string;
  yUnit?: string;
  /** Título visible arriba del gráfico */
  title: string;
  /** Subtítulo opcional (ej. "Cada punto = un vehículo del grupo") */
  subtitle?: string;
}

export function PositionInGroupScatter({
  points,
  activeId,
  xLabel,
  yLabel,
  formatX = (n) => n.toLocaleString("es-AR"),
  formatY = (n) => n.toLocaleString("es-AR"),
  xUnit,
  yUnit,
  title,
  subtitle,
}: Props) {
  if (points.length < 2) return null;

  // Separar activo de peers para renderizar como series distintas
  const peers = points.filter((p) => p.id !== activeId);
  const active = points.find((p) => p.id === activeId);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h4 className={styles.title}>{title}</h4>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart
            margin={{ top: 12, right: 16, bottom: 36, left: 36 }}
          >
            <CartesianGrid
              stroke="var(--brd)"
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tick={{ fontSize: 10, fill: "var(--t3)" }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -20,
                fontSize: 11,
                fill: "var(--t2)",
              }}
              stroke="var(--brd)"
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              tick={{ fontSize: 10, fill: "var(--t3)" }}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                offset: 0,
                fontSize: 11,
                fill: "var(--t2)",
              }}
              stroke="var(--brd)"
            />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <CustomTooltip
                  xLabel={xLabel}
                  yLabel={yLabel}
                  formatX={formatX}
                  formatY={formatY}
                  xUnit={xUnit}
                  yUnit={yUnit}
                />
              }
            />
            {/* Peers · gris atenuado, debajo */}
            <Scatter
              data={peers}
              fill="#94A3B8"
              fillOpacity={0.55}
              shape="circle"
            />
            {/* Activo · color marca, encima · más grande */}
            {active && (
              <Scatter
                data={[active]}
                fill="#2563EB"
                stroke="#1D4ED8"
                strokeWidth={2}
                shape="circle"
              >
                {/* Z mayor para que se vea más grande */}
                <ZAxis range={[180, 180]} />
              </Scatter>
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda manual · solo 2 entradas */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotActive}`} />
          Este vehículo
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotPeer}`} />
          Resto del grupo ({peers.length})
        </span>
      </div>
    </div>
  );
}

// ─── Tooltip custom · resalta si es el activo ──────────────

function CustomTooltip({
  active,
  payload,
  xLabel,
  yLabel,
  formatX,
  formatY,
  xUnit,
  yUnit,
}: TooltipProps<number, string> & {
  xLabel: string;
  yLabel: string;
  formatX: (n: number) => string;
  formatY: (n: number) => string;
  xUnit?: string;
  yUnit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload as ScatterPoint | undefined;
  if (!p) return null;

  return (
    <div className={styles.tooltip}>
      <div className={styles.ttHead}>
        <span className={styles.ttName}>{p.name}</span>
        {p.plate && <span className={styles.ttPlate}>{p.plate}</span>}
      </div>
      <div className={styles.ttRow}>
        <span className={styles.ttLabel}>{xLabel}</span>
        <span className={styles.ttValue}>
          {formatX(p.x)}
          {xUnit && <span className={styles.ttUnit}> {xUnit}</span>}
        </span>
      </div>
      <div className={styles.ttRow}>
        <span className={styles.ttLabel}>{yLabel}</span>
        <span className={styles.ttValue}>
          {formatY(p.y)}
          {yUnit && <span className={styles.ttUnit}> {yUnit}</span>}
        </span>
      </div>
    </div>
  );
}
