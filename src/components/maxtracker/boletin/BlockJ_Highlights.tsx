import type { BoletinData } from "@/app/(product)/direccion/boletin/[period]/page";
import Link from "next/link";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque J · Highlights y observaciones
//  ─────────────────────────────────────────────────────────────
//  Cierre editorial del boletín · destila los datos en
//  observaciones accionables. NO usa IA · son frases templated
//  generadas a partir de los rankings y agregados ya calculados.
//
//  Cada highlight tiene un símbolo según el tono:
//    ↗  positivo (mejora vs anterior)
//    ↘  negativo (empeora vs anterior · ALTO contexto)
//    →  neutral (info sin signo)
//    ⚠  warning (anomalías o pendientes)
//
//  La regla clave · si una métrica baja en eventos eso es BUENO,
//  si baja en distancia eso es NEUTRAL/INFO. La semántica importa.
// ═══════════════════════════════════════════════════════════════

const MIN_KM_FOR_RANKING = 50;
const MIN_VEHICLES_FOR_STATS = 5;
const Z_THRESHOLD = 2;
const MIN_DRIVER_TRIPS = 5;

interface Props {
  data: BoletinData;
}

interface Highlight {
  kind: "positive" | "negative" | "neutral" | "warning";
  /** Texto plano · puede tener <strong> via render */
  parts: HighlightPart[];
}

type HighlightPart =
  | { kind: "text"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "link"; value: string; href: string };

export function BlockJ_Highlights({ data }: Props) {
  const items: Highlight[] = [];

  // ── 1. Tendencia de distancia vs período anterior ─────────────
  if (data.previous.distanceKm > 0) {
    const delta =
      ((data.current.distanceKm - data.previous.distanceKm) /
        data.previous.distanceKm) *
      100;
    if (Math.abs(delta) >= 5) {
      items.push({
        kind: "neutral",
        parts: [
          { kind: "text", value: "Distancia total " },
          {
            kind: "strong",
            value:
              delta > 0
                ? `subió ${Math.round(delta)}%`
                : `bajó ${Math.round(Math.abs(delta))}%`,
          },
          { kind: "text", value: " vs período anterior · " },
          {
            kind: "strong",
            value: `${Math.round(data.current.distanceKm).toLocaleString("es-AR")} km`,
          },
          { kind: "text", value: "." },
        ],
      });
    }
  }

  // ── 2. Tendencia de eventos (alto = malo) ────────────────────
  if (data.previous.eventCount > 0) {
    const delta =
      ((data.current.eventCount - data.previous.eventCount) /
        data.previous.eventCount) *
      100;
    if (Math.abs(delta) >= 10) {
      items.push({
        kind: delta < 0 ? "positive" : "negative",
        parts: [
          { kind: "text", value: "Eventos " },
          {
            kind: "strong",
            value:
              delta < 0
                ? `bajaron ${Math.round(Math.abs(delta))}%`
                : `subieron ${Math.round(delta)}%`,
          },
          {
            kind: "text",
            value: ` vs período anterior · ${data.current.eventCount.toLocaleString("es-AR")} en total.`,
          },
        ],
      });
    }
  }

  // ── 3. Mejor vehículo (calidad de conducción) ────────────────
  const eligibleVehicles = data.vehicles.filter(
    (v) => v.distanceKm >= MIN_KM_FOR_RANKING,
  );
  if (eligibleVehicles.length > 0) {
    const sorted = [...eligibleVehicles].sort(
      (a, b) => a.eventsPer100km - b.eventsPer100km,
    );
    const best = sorted[0]!;
    items.push({
      kind: "positive",
      parts: [
        { kind: "text", value: "Vehículo más seguro · " },
        {
          kind: "link",
          value: best.assetName,
          href: `/objeto/vehiculo/${best.assetId}`,
        },
        { kind: "text", value: " con " },
        {
          kind: "strong",
          value: `${best.eventsPer100km.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ev/100km`,
        },
        {
          kind: "text",
          value: ` en ${Math.round(best.distanceKm).toLocaleString("es-AR")} km recorridos.`,
        },
      ],
    });

    // ── 4. Peor vehículo · solo si es notoriamente peor ────────
    const worst = sorted[sorted.length - 1]!;
    // Solo destacar si tiene al menos 1 evento (ratio significativo)
    if (worst.eventCount > 0 && worst.eventsPer100km > 1) {
      items.push({
        kind: "negative",
        parts: [
          { kind: "text", value: "Vehículo a revisar · " },
          {
            kind: "link",
            value: worst.assetName,
            href: `/objeto/vehiculo/${worst.assetId}`,
          },
          { kind: "text", value: " con " },
          {
            kind: "strong",
            value: `${worst.eventsPer100km.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ev/100km`,
          },
          {
            kind: "text",
            value: ` (${worst.eventCount} eventos en ${Math.round(worst.distanceKm).toLocaleString("es-AR")} km).`,
          },
        ],
      });
    }
  }

  // ── 5. Mejor conductor · top safetyScore con mínimo de viajes ─
  const eligibleDrivers = data.drivers.filter(
    (d) => d.tripCount >= MIN_DRIVER_TRIPS,
  );
  if (eligibleDrivers.length > 0) {
    const topDriver = [...eligibleDrivers].sort(
      (a, b) => b.safetyScore - a.safetyScore,
    )[0]!;
    if (topDriver.safetyScore >= 80) {
      items.push({
        kind: "positive",
        parts: [
          { kind: "text", value: "Conductor destacado · " },
          {
            kind: "link",
            value: topDriver.fullName,
            href: `/objeto/conductor/${topDriver.personId}`,
          },
          { kind: "text", value: " con score de seguridad " },
          { kind: "strong", value: `${Math.round(topDriver.safetyScore)}/100` },
          {
            kind: "text",
            value: ` en ${topDriver.tripCount} viajes del período.`,
          },
        ],
      });
    }
  }

  // ── 6. Anomalías estadísticas (Bloque H · resumen) ───────────
  if (eligibleVehicles.length >= MIN_VEHICLES_FOR_STATS) {
    const anomVehicles = countAnomVehicles(eligibleVehicles);
    if (anomVehicles > 0) {
      items.push({
        kind: "warning",
        parts: [
          { kind: "strong", value: `${anomVehicles}` },
          {
            kind: "text",
            value: ` ${anomVehicles === 1 ? "vehículo" : "vehículos"} con métricas fuera de banda ±2σ · revisá el Bloque H para detalle.`,
          },
        ],
      });
    }
  }

  // ── 7. MTTR de alarmas ───────────────────────────────────────
  if (data.alarms.total > 0) {
    const h = Math.floor(data.alarms.mttrMin / 60);
    const m = Math.round(data.alarms.mttrMin % 60);
    const mttrText = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
    const mttrKind: Highlight["kind"] =
      data.alarms.mttrMin < 120
        ? "positive"
        : data.alarms.mttrMin < 240
          ? "neutral"
          : "negative";
    items.push({
      kind: mttrKind,
      parts: [
        { kind: "text", value: "Tiempo medio de cierre de alarmas · " },
        { kind: "strong", value: mttrText },
        {
          kind: "text",
          value: ` sobre ${data.alarms.total} ${data.alarms.total === 1 ? "alarma" : "alarmas"} del período.`,
        },
      ],
    });
  }

  // ── 8. Alarmas activas al cierre ─────────────────────────────
  if (data.alarms.activeAtClose >= 0) {
    if (data.alarms.activeAtClose === 0) {
      items.push({
        kind: "positive",
        parts: [
          {
            kind: "text",
            value: "Sin alarmas pendientes al cierre del período.",
          },
        ],
      });
    } else if (data.alarms.activeAtClose >= 5) {
      items.push({
        kind: "warning",
        parts: [
          { kind: "strong", value: `${data.alarms.activeAtClose}` },
          {
            kind: "text",
            value: ` ${data.alarms.activeAtClose === 1 ? "alarma activa" : "alarmas activas"} al cierre · pendientes de atención.`,
          },
        ],
      });
    }
  }

  // ── 9. Mejor grupo (calidad de conducción) ───────────────────
  const eligibleGroups = data.groups.filter(
    (g) => g.distanceKm >= MIN_KM_FOR_RANKING * 5,
  );
  if (eligibleGroups.length >= 2) {
    const bestGroup = [...eligibleGroups].sort(
      (a, b) => a.eventsPer100km - b.eventsPer100km,
    )[0]!;
    items.push({
      kind: "positive",
      parts: [
        { kind: "text", value: "Grupo con mejor performance · " },
        { kind: "strong", value: bestGroup.groupName },
        { kind: "text", value: " con " },
        {
          kind: "strong",
          value: `${bestGroup.eventsPer100km.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ev/100km`,
        },
        { kind: "text", value: ` (${bestGroup.assetCount} vehículos).` },
      ],
    });
  }

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>J</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Highlights y observaciones</h2>
          <p className={styles.blockHint}>
            Cierre editorial del período · lo más relevante destilado de los
            indicadores anteriores.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Sin highlights generados para el período. Datos insuficientes o todo
          dentro de lo esperado.
        </p>
      ) : (
        <ul className={styles.highlightList}>
          {items.map((item, idx) => (
            <HighlightItem key={idx} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HighlightItem({ item }: { item: Highlight }) {
  const symbol = SYMBOL[item.kind];
  const symbolClass = `${styles.highlightSymbol} ${styles[`highlightSymbol_${item.kind}`]}`;

  return (
    <li className={styles.highlightItem}>
      <span className={symbolClass} aria-hidden="true">
        {symbol}
      </span>
      <span className={styles.highlightText}>
        {item.parts.map((p, i) => {
          if (p.kind === "text") return <span key={i}>{p.value}</span>;
          if (p.kind === "strong")
            return <strong key={i}>{p.value}</strong>;
          if (p.kind === "link") {
            return (
              <Link
                key={i}
                href={p.href}
                className={styles.highlightLink}
              >
                {p.value}
              </Link>
            );
          }
          return null;
        })}
      </span>
    </li>
  );
}

const SYMBOL: Record<Highlight["kind"], string> = {
  positive: "↗",
  negative: "↘",
  neutral: "→",
  warning: "⚠",
};

// ═══════════════════════════════════════════════════════════════
//  Helper · cuenta vehículos con anomalías ±2σ en cualquiera de
//  4 métricas. Comparte lógica con BlockH (no compartido por
//  archivo para mantener cada bloque autocontenido).
// ═══════════════════════════════════════════════════════════════

function countAnomVehicles(
  vehicles: { distanceKm: number; tripCount: number; activeMin: number; eventsPer100km: number; assetId: string }[],
): number {
  const metrics: (keyof Pick<
    (typeof vehicles)[0],
    "distanceKm" | "tripCount" | "activeMin" | "eventsPer100km"
  >)[] = ["distanceKm", "tripCount", "activeMin", "eventsPer100km"];

  const anomalous = new Set<string>();
  for (const m of metrics) {
    const values = vehicles.map((v) => v[m]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let sq = 0;
    for (const v of values) sq += (v - mean) * (v - mean);
    const stddev = Math.sqrt(sq / values.length);
    if (stddev < 1e-9) continue;
    for (const v of vehicles) {
      const z = (v[m] - mean) / stddev;
      if (Math.abs(z) > Z_THRESHOLD) anomalous.add(v.assetId);
    }
  }
  return anomalous.size;
}
