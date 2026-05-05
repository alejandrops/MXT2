import styles from "./SpeedCurve.module.css";

// ═══════════════════════════════════════════════════════════════
//  SpeedCurve · S4-L3d (extraído de InfractionDetailPanel S4-L3c)
//  ─────────────────────────────────────────────────────────────
//  Curva velocidad/tiempo de una infracción · SVG inline puro,
//  sin hooks ni dependencias de cliente. Reusable en:
//    · InfractionDetailPanel (side panel · S4-L3c)
//    · InfractionReceipt    (print PDF · S4-L3d)
//
//  Marca · línea horizontal punteada al nivel de vmax + área
//  de exceso rellena con color de severity.
// ═══════════════════════════════════════════════════════════════

export interface SpeedSample {
  t: number; // segundos desde inicio
  v: number; // km/h
}

interface Props {
  samples: SpeedSample[];
  vmaxKmh: number;
  /** Color para la curva y el área de exceso · típicamente el
   *  color de la severity de la infracción. */
  color: string;
  /** Altura del SVG en px (default 96 · panel · 160 sirve para print) */
  height?: number;
  /** Si se omite, no se muestra título encima */
  title?: string;
}

function formatDurationShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

export function SpeedCurve({
  samples,
  vmaxKmh,
  color,
  height = 96,
  title,
}: Props) {
  if (samples.length < 2) return null;

  const W = 280;
  const H = height;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 18;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const tMax = samples[samples.length - 1]!.t;
  const vMax = Math.max(...samples.map((s) => s.v), vmaxKmh) * 1.05;
  const vMin = Math.min(...samples.map((s) => s.v)) * 0.9;

  const x = (t: number) => PAD_L + (t / tMax) * innerW;
  const y = (v: number) => PAD_T + innerH - ((v - vMin) / (vMax - vMin)) * innerH;

  const path = samples
    .map(
      (s, i) =>
        `${i === 0 ? "M" : "L"} ${x(s.t).toFixed(1)} ${y(s.v).toFixed(1)}`,
    )
    .join(" ");

  // Área bajo la curva por encima de vmax · resaltar exceso
  const aboveLimitArea = (() => {
    const pts: string[] = [];
    let inside = false;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]!;
      if (s.v > vmaxKmh) {
        if (!inside) {
          pts.push(`M ${x(s.t).toFixed(1)} ${y(vmaxKmh).toFixed(1)}`);
          inside = true;
        }
        pts.push(`L ${x(s.t).toFixed(1)} ${y(s.v).toFixed(1)}`);
      } else if (inside) {
        pts.push(`L ${x(s.t).toFixed(1)} ${y(vmaxKmh).toFixed(1)} Z`);
        inside = false;
      }
    }
    if (inside) {
      const last = samples[samples.length - 1]!;
      pts.push(`L ${x(last.t).toFixed(1)} ${y(vmaxKmh).toFixed(1)} Z`);
    }
    return pts.join(" ");
  })();

  return (
    <div className={styles.wrap}>
      {title && <div className={styles.title}>{title}</div>}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
      >
        <text
          x={2}
          y={y(vMin) + 3}
          fontSize={9}
          fill="#94a3b8"
          fontFamily="ui-monospace"
        >
          {Math.round(vMin)}
        </text>
        <text
          x={2}
          y={y(vMax) + 3}
          fontSize={9}
          fill="#94a3b8"
          fontFamily="ui-monospace"
        >
          {Math.round(vMax)}
        </text>
        <text
          x={PAD_L}
          y={H - 2}
          fontSize={9}
          fill="#94a3b8"
          fontFamily="ui-monospace"
        >
          0s
        </text>
        <text
          x={W - PAD_R}
          y={H - 2}
          fontSize={9}
          fill="#94a3b8"
          fontFamily="ui-monospace"
          textAnchor="end"
        >
          {formatDurationShort(Math.round(tMax))}
        </text>

        {/* Línea de referencia vmax */}
        <line
          x1={PAD_L}
          y1={y(vmaxKmh)}
          x2={W - PAD_R}
          y2={y(vmaxKmh)}
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={W - PAD_R - 2}
          y={y(vmaxKmh) - 3}
          fontSize={9}
          fill="#64748b"
          fontFamily="ui-monospace"
          textAnchor="end"
        >
          vmax {vmaxKmh}
        </text>

        {/* Área de exceso */}
        {aboveLimitArea && (
          <path d={aboveLimitArea} fill={color} fillOpacity={0.18} />
        )}

        {/* Curva */}
        <path d={path} fill="none" stroke={color} strokeWidth={1.6} />
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helper · convierte samples del trackJson al formato SpeedSample
//  ─────────────────────────────────────────────────────────────
//  trackJson es un array de [lat, lon, isoTimestamp, speedKmh].
//  Devuelve [] si parsing falla (caller debería detectar y no
//  renderizar la curva).
// ═══════════════════════════════════════════════════════════════

export function parseTrackToSpeedSamples(trackJson: string): SpeedSample[] {
  try {
    const raw = JSON.parse(trackJson) as Array<[number, number, string, number]>;
    if (raw.length === 0) return [];
    const t0 = new Date(raw[0]![2]).getTime();
    return raw.map(([, , iso, v]) => ({
      t: (new Date(iso).getTime() - t0) / 1000,
      v,
    }));
  } catch {
    return [];
  }
}
