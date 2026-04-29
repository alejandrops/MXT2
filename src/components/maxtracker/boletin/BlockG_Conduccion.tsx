import type { BoletinData } from "@/app/(product)/direccion/boletin/[period]/page";
import { KpiCard } from "@/components/maxtracker/ui";
import Link from "next/link";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque G · Conducción · eventos
//  ─────────────────────────────────────────────────────────────
//  Eventos accionables del período (sin telemetría) y su distribución
//  por tipo · top vehículos generadores. Permite ver qué tipo de
//  comportamiento dominó el mes (mucho exceso de velocidad? mucha
//  curva brusca? frenado?) para enfocar acciones de coaching.
//
//  Diferencia con Bloque F: aquí no hay lifecycle · son detecciones
//  primarias · no necesariamente derivaron en alarma. Una alarma se
//  dispara cuando un patrón de eventos cumple una regla.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: BoletinData;
}

export function BlockG_Conduccion({ data }: Props) {
  const { current, previous, eventsByType, vehicles } = data;

  const deltaEvents = computeDelta(current.eventCount, previous.eventCount);

  // Ratio eventos/100km de la flota
  const eventsPer100km =
    current.distanceKm > 0
      ? (current.eventCount / current.distanceKm) * 100
      : 0;

  // Top 5 vehículos por cantidad absoluta de eventos
  // (a diferencia del Bloque D que usa eventos/100km · acá nos
  // interesa el volumen total que vino de cada vehículo)
  const topByVolume = [...vehicles]
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 5)
    .filter((v) => v.eventCount > 0);

  // Top 5 tipos · ya viene ordenado por count desc
  const topTypes = eventsByType.slice(0, 5);

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>G</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Conducción · eventos</h2>
          <p className={styles.blockHint}>
            Eventos accionables detectados (excluye telemetría) · breakdown
            por tipo y top vehículos generadores · útil para enfocar
            coaching y acciones correctivas.
          </p>
        </div>
      </header>

      {/* KPIs · 3 cards */}
      <div className={styles.kpiGrid3}>
        <KpiCard
          size="md"
          label="Total del período"
          value={current.eventCount.toLocaleString("es-AR")}
          delta={deltaEvents}
          deltaLabel="vs mes anterior"
          isReverseDelta
        />
        <KpiCard
          size="md"
          label="Eventos / 100km"
          value={eventsPer100km.toLocaleString("es-AR", {
            maximumFractionDigits: 2,
          })}
        />
        <KpiCard
          size="md"
          label="Tipos distintos"
          value={eventsByType.length.toLocaleString("es-AR")}
        />
      </div>

      {current.eventCount === 0 ? (
        <p className={styles.empty}>
          No se registraron eventos en el período.
        </p>
      ) : (
        <div className={styles.gGrid}>
          {/* Breakdown por tipo · top 5 */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Top tipos de evento</h3>
            <BreakdownBars
              items={topTypes.map((t) => ({
                label: humanizeEventType(t.type),
                value: t.count,
              }))}
              total={current.eventCount}
            />
          </div>

          {/* Top vehículos por volumen */}
          {topByVolume.length > 0 && (
            <div className={styles.subsection}>
              <h3 className={styles.subsectionTitle}>
                Top vehículos por volumen
              </h3>
              <ol className={styles.rankList}>
                {topByVolume.map((v, i) => (
                  <li key={v.assetId} className={styles.rankRow}>
                    <span className={styles.rankNum}>{i + 1}</span>
                    <span className={styles.rankPrimary}>
                      <Link
                        href={`/objeto/vehiculo/${v.assetId}`}
                        className={styles.rankLink}
                      >
                        {v.assetName}
                      </Link>
                      {v.plate && (
                        <span className={styles.rankPlate}>{v.plate}</span>
                      )}
                      {v.groupName && (
                        <span className={styles.rankSec}>{v.groupName}</span>
                      )}
                    </span>
                    <span className={styles.rankValue}>
                      <span className={styles.rankBad}>
                        {v.eventCount.toLocaleString("es-AR")}
                      </span>
                      <span className={styles.rankUnit}>eventos</span>
                      <span className={styles.rankAux}>
                        {v.distanceKm.toLocaleString("es-AR", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        km
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BreakdownBars · barras horizontales con label/value/pct
// ═══════════════════════════════════════════════════════════════

function BreakdownBars({
  items,
  total,
}: {
  items: { label: string; value: number }[];
  total: number;
}) {
  const max = Math.max(0.001, ...items.map((i) => i.value));
  return (
    <div className={styles.bdGrid}>
      {items.map((item) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        const barPct = (item.value / max) * 100;
        return (
          <div key={item.label} className={styles.bdRow}>
            <span className={styles.bdLabel}>{item.label}</span>
            <div className={styles.bdTrack}>
              <div
                className={`${styles.bdFill} ${styles.bdFillNeutral}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <span className={styles.bdValue}>
              {item.value.toLocaleString("es-AR")}
              <span className={styles.bdPct}>· {pct.toFixed(0)}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function computeDelta(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return (current - prev) / prev;
}

function humanizeEventType(t: string): string {
  const map: Record<string, string> = {
    SPEEDING: "Exceso de velocidad",
    HARSH_BRAKING: "Frenado brusco",
    HARSH_ACCELERATION: "Aceleración brusca",
    HARSH_CORNERING: "Curva brusca",
    IDLING: "Ralentí prolongado",
    IDLE: "Ralentí prolongado",
    GEOFENCE_ENTER: "Entrada a zona",
    GEOFENCE_EXIT: "Salida de zona",
    PANIC: "Botón de pánico",
    IMPACT: "Impacto detectado",
    AFTER_HOURS: "Encendido fuera de horario",
    POWER_DISCONNECT: "Desconexión de batería",
    LOW_BATTERY: "Batería baja",
  };
  return map[t] ?? t;
}
