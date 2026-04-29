import type {
  BoletinData,
  VehicleRow,
} from "@/app/(product)/direccion/boletin/[period]/page";
import Link from "next/link";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque H · Anomalías estadísticas · Geotab Exception Report
//  ─────────────────────────────────────────────────────────────
//  Detecta vehículos cuya métrica del período cae fuera de la
//  banda [μ − 2σ, μ + 2σ] de la flota. Para cada anomalía
//  reporta: vehículo, métrica afectada, valor, banda esperada,
//  desvío en σ.
//
//  Filtros de relevancia:
//    · Solo vehículos con >50 km · evita ratios infinitos en
//      vehículos casi inactivos (consistente con Bloque D).
//    · Solo se evalúan métricas con σ > 0 · si todos los valores
//      son idénticos no hay nada que destacar.
//    · MIN_VEHICLES_FOR_STATS = 5 · debajo de eso, n es muy
//      pequeño para sacar conclusiones estadísticas.
//
//  Métricas evaluadas:
//    · distanceKm        (uso de flota · alto/bajo neutro)
//    · tripCount         (fragmentación · alto/bajo neutro)
//    · activeMin         (jornada · alto/bajo neutro)
//    · eventsPer100km    (calidad de conducción · ALTO = malo)
//
//  Cap visual · 10 anomalías. Si hay más, banner con "+N más".
// ═══════════════════════════════════════════════════════════════

const MIN_KM_FOR_RANKING = 50;
const MIN_VEHICLES_FOR_STATS = 5;
const Z_THRESHOLD = 2;
const MAX_ROWS = 10;

interface Props {
  data: BoletinData;
}

type MetricKey = "distanceKm" | "tripCount" | "activeMin" | "eventsPer100km";

interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: string;
  /** Si alto = peor, marcamos con color crítico cuando se desvía hacia arriba */
  highIsBad: boolean;
  /** Cómo formatear el valor para mostrar */
  format: (v: number) => string;
}

const METRICS: MetricMeta[] = [
  {
    key: "distanceKm",
    label: "Distancia",
    unit: "km",
    highIsBad: false,
    format: (v) =>
      v.toLocaleString("es-AR", { maximumFractionDigits: 0 }),
  },
  {
    key: "tripCount",
    label: "Viajes",
    unit: "",
    highIsBad: false,
    format: (v) => String(Math.round(v)),
  },
  {
    key: "activeMin",
    label: "Tiempo en marcha",
    unit: "h",
    highIsBad: false,
    format: (v) =>
      (v / 60).toLocaleString("es-AR", { maximumFractionDigits: 1 }),
  },
  {
    key: "eventsPer100km",
    label: "Eventos / 100km",
    unit: "",
    highIsBad: true,
    format: (v) =>
      v.toLocaleString("es-AR", { maximumFractionDigits: 2 }),
  },
];

interface Anomaly {
  vehicle: VehicleRow;
  metric: MetricMeta;
  value: number;
  mean: number;
  stddev: number;
  zScore: number;
  bandLow: number;
  bandHigh: number;
}

export function BlockH_AnomaliasEstadisticas({ data }: Props) {
  const eligible = data.vehicles.filter(
    (v) => v.distanceKm >= MIN_KM_FOR_RANKING,
  );

  const insufficient = eligible.length < MIN_VEHICLES_FOR_STATS;

  const anomalies: Anomaly[] = [];

  if (!insufficient) {
    for (const metric of METRICS) {
      const values = eligible.map((v) => v[metric.key]);
      const stats = computeStats(values);
      // Si σ ≈ 0, todos los valores son iguales · saltar
      if (stats.stddev < 1e-9) continue;

      for (const v of eligible) {
        const value = v[metric.key];
        const z = (value - stats.mean) / stats.stddev;
        if (Math.abs(z) > Z_THRESHOLD) {
          anomalies.push({
            vehicle: v,
            metric,
            value,
            mean: stats.mean,
            stddev: stats.stddev,
            zScore: z,
            bandLow: stats.mean - Z_THRESHOLD * stats.stddev,
            bandHigh: stats.mean + Z_THRESHOLD * stats.stddev,
          });
        }
      }
    }
  }

  // Ordenar por |z| descendente · más extremas primero
  anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  const visible = anomalies.slice(0, MAX_ROWS);
  const overflow = anomalies.length - visible.length;

  const uniqueVehicles = new Set(visible.map((a) => a.vehicle.assetId)).size;

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>H</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Anomalías estadísticas</h2>
          <p className={styles.blockHint}>
            Vehículos con métricas fuera de la banda ±2σ del promedio de la
            flota · solo entran al análisis vehículos con más de{" "}
            {MIN_KM_FOR_RANKING} km en el período.
          </p>
        </div>
      </header>

      {insufficient ? (
        <p className={styles.empty}>
          Pocos vehículos con actividad en el período (mínimo{" "}
          {MIN_VEHICLES_FOR_STATS} para análisis estadístico).
        </p>
      ) : anomalies.length === 0 ? (
        <p className={styles.empty}>
          Sin anomalías. Toda la flota dentro de banda normal en las{" "}
          {METRICS.length} métricas evaluadas.
        </p>
      ) : (
        <>
          <p className={styles.lead}>
            <strong>{anomalies.length}</strong>{" "}
            {anomalies.length === 1 ? "anomalía" : "anomalías"} detectada
            {anomalies.length === 1 ? "" : "s"} en{" "}
            <strong>{uniqueVehicles}</strong>{" "}
            {uniqueVehicles === 1 ? "vehículo" : "vehículos"}.
          </p>
          <table className={styles.anomTable}>
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Métrica</th>
                <th className={styles.anomNumCell}>Valor</th>
                <th className={styles.anomNumCell}>Banda esperada</th>
                <th className={styles.anomNumCell}>Desvío</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a, i) => (
                <AnomalyRow key={`${a.vehicle.assetId}-${a.metric.key}-${i}`} a={a} />
              ))}
            </tbody>
          </table>
          {overflow > 0 && (
            <p className={styles.empty}>
              + {overflow} {overflow === 1 ? "anomalía adicional" : "anomalías adicionales"} no mostradas.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function AnomalyRow({ a }: { a: Anomaly }) {
  const isUp = a.zScore > 0;
  const isCritical = isUp && a.metric.highIsBad;

  const valueClass = isCritical
    ? styles.anomValueBad
    : styles.anomValue;

  const arrow = isUp ? "↑" : "↓";
  const arrowClass = isCritical
    ? styles.anomArrowBad
    : styles.anomArrowNeutral;

  return (
    <tr>
      <td className={styles.anomVehCell}>
        <Link
          href={`/objeto/vehiculo/${a.vehicle.assetId}`}
          className={styles.rankLink}
        >
          {a.vehicle.assetName}
        </Link>
        {a.vehicle.plate && (
          <span className={styles.rankPlate}>{a.vehicle.plate}</span>
        )}
        {a.vehicle.groupName && (
          <span className={styles.rankSec}>{a.vehicle.groupName}</span>
        )}
      </td>
      <td className={styles.anomMetricCell}>
        {a.metric.label}
      </td>
      <td className={`${styles.anomNumCell} ${valueClass}`}>
        {a.metric.format(a.value)}
        {a.metric.unit && (
          <span className={styles.rankUnit}> {a.metric.unit}</span>
        )}
      </td>
      <td className={`${styles.anomNumCell} ${styles.anomBandCell}`}>
        {a.metric.format(Math.max(0, a.bandLow))} —{" "}
        {a.metric.format(a.bandHigh)}
      </td>
      <td className={`${styles.anomNumCell} ${styles.anomDeviation}`}>
        <span className={arrowClass}>{arrow}</span>{" "}
        {Math.abs(a.zScore).toLocaleString("es-AR", {
          maximumFractionDigits: 1,
        })}
        σ
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Stats helper · μ y σ poblacional (no sample · tenemos el universo)
// ═══════════════════════════════════════════════════════════════

function computeStats(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;
  let sqDiff = 0;
  for (const v of values) sqDiff += (v - mean) * (v - mean);
  const variance = sqDiff / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}
