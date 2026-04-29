import type { BoletinData } from "@/app/(product)/direccion/boletin/[period]/page";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque B · Salud operativa
//  ─────────────────────────────────────────────────────────────
//  Promedios por vehículo y distribución temporal del mes.
//  Permite contextualizar los totales del Bloque A: si la flota
//  hizo 100K km, ¿es porque trabajaron muchos vehículos o pocos
//  con mucho uso? Y · ¿la actividad estuvo pareja o concentrada
//  en algunos días?
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: BoletinData;
}

export function BlockB_SaludOperativa({ data }: Props) {
  const { current, daily } = data;
  const activeAssets = Math.max(1, current.activeAssetCount);

  const avgKm = current.distanceKm / activeAssets;
  const avgHours = current.activeMin / 60 / activeAssets;
  const avgTrips = current.tripCount / activeAssets;
  const avgEvents = current.eventCount / activeAssets;

  // Eventos por 100km · ratio operativo clásico
  const eventsPer100km =
    current.distanceKm > 0
      ? (current.eventCount / current.distanceKm) * 100
      : 0;

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>B</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Salud operativa</h2>
          <p className={styles.blockHint}>
            Promedios por vehículo activo y distribución de la actividad a lo
            largo del mes.
          </p>
        </div>
      </header>

      {/* Tabla densa · 5 promedios */}
      <table className={styles.statsTable}>
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Total flota</th>
            <th>Por vehículo activo</th>
          </tr>
        </thead>
        <tbody>
          <StatsRow
            label="Distancia"
            total={`${current.distanceKm.toLocaleString("es-AR", { maximumFractionDigits: 0 })} km`}
            avg={`${avgKm.toLocaleString("es-AR", { maximumFractionDigits: 0 })} km`}
          />
          <StatsRow
            label="Horas activas"
            total={`${(current.activeMin / 60).toLocaleString("es-AR", { maximumFractionDigits: 0 })} h`}
            avg={`${avgHours.toLocaleString("es-AR", { maximumFractionDigits: 1 })} h`}
          />
          <StatsRow
            label="Viajes"
            total={current.tripCount.toLocaleString("es-AR")}
            avg={avgTrips.toLocaleString("es-AR", {
              maximumFractionDigits: 1,
            })}
          />
          <StatsRow
            label="Eventos relevantes"
            total={current.eventCount.toLocaleString("es-AR")}
            avg={avgEvents.toLocaleString("es-AR", {
              maximumFractionDigits: 1,
            })}
          />
          <StatsRow
            label="Eventos / 100 km"
            total="—"
            avg={eventsPer100km.toLocaleString("es-AR", {
              maximumFractionDigits: 2,
            })}
            isRatio
          />
        </tbody>
      </table>

      {/* Distribución temporal · barras por día */}
      <div className={styles.subsection}>
        <h3 className={styles.subsectionTitle}>Distribución de la actividad</h3>
        {daily.length === 0 ? (
          <p className={styles.empty}>Sin actividad en el período.</p>
        ) : (
          <DailyBars daily={daily} />
        )}
      </div>
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StatsRow({
  label,
  total,
  avg,
  isRatio = false,
}: {
  label: string;
  total: string;
  avg: string;
  isRatio?: boolean;
}) {
  return (
    <tr>
      <td>
        {label}
        {isRatio && <span className={styles.statHint}> · ratio</span>}
      </td>
      <td className={styles.statValue}>{total}</td>
      <td className={styles.statValue}>{avg}</td>
    </tr>
  );
}

function DailyBars({ daily }: { daily: { day: string; distanceKm: number }[] }) {
  const max = Math.max(0.001, ...daily.map((d) => d.distanceKm));
  const W = 940;
  const H = 80;
  const padL = 0;
  const padR = 0;
  const padT = 4;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / daily.length;
  const barW = slot * 0.7;
  const gap = slot * 0.3;

  // Etiquetar primero, último y cada 5
  const labelEvery = daily.length <= 14 ? 1 : daily.length <= 31 ? 5 : 10;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={styles.barsSvg}
    >
      {daily.map((d, i) => {
        const x = padL + i * slot + gap / 2;
        const h = (d.distanceKm / max) * innerH;
        const y = padT + innerH - h;
        const showLabel =
          i === 0 || i === daily.length - 1 || (i + 1) % labelEvery === 0;
        const dayN = d.day.split("-")[2] ?? "";
        return (
          <g key={d.day}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0.5)}
              className={styles.bar}
            >
              <title>{`${d.day}: ${d.distanceKm.toLocaleString("es-AR", { maximumFractionDigits: 0 })} km`}</title>
            </rect>
            {showLabel && (
              <text
                x={x + barW / 2}
                y={padT + innerH + 12}
                textAnchor="middle"
                className={styles.barLbl}
              >
                {dayN}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
