import type { BoletinData, GroupRow } from "@/app/(product)/direccion/boletin/[period]/page";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque C · Performance por grupo
//  ─────────────────────────────────────────────────────────────
//  Ranking compacto de los grupos de la flota · cada grupo con sus
//  KPIs principales y posición relativa.
//
//  Ordenamiento: por distancia recorrida (más activo primero).
//  Métrica de calidad: eventos / 100 km · permite comparar grupos
//  con distinto nivel de uso ("eficiencia" del grupo).
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: BoletinData;
}

export function BlockC_PerformanceGrupos({ data }: Props) {
  const { groups } = data;

  if (groups.length === 0) {
    return (
      <section className={styles.block}>
        <header className={styles.blockHeader}>
          <span className={styles.blockLetter}>C</span>
          <div className={styles.blockTitleWrap}>
            <h2 className={styles.blockTitle}>Performance por grupo</h2>
            <p className={styles.blockHint}>
              Ranking de grupos por distancia y calidad operativa.
            </p>
          </div>
        </header>
        <p className={styles.empty}>Sin grupos con actividad en el período.</p>
      </section>
    );
  }

  const maxKm = Math.max(0.001, ...groups.map((g) => g.distanceKm));
  // Para eventos / 100km · el peor del período define la escala visual
  const maxRatio = Math.max(0.001, ...groups.map((g) => g.eventsPer100km));

  // Ranking por calidad (eventos/100km, menos es mejor) · marca top 1 y bottom 1
  const sortedByQuality = [...groups].sort(
    (a, b) => a.eventsPer100km - b.eventsPer100km,
  );
  const bestGroupId = sortedByQuality[0]?.groupId ?? null;
  const worstGroupId =
    sortedByQuality.length > 1
      ? sortedByQuality[sortedByQuality.length - 1]?.groupId ?? null
      : null;

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>C</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Performance por grupo</h2>
          <p className={styles.blockHint}>
            Ranking ordenado por distancia · indicador "eventos / 100km" como
            proxy de calidad operativa (menos = mejor).
          </p>
        </div>
      </header>

      <table className={styles.statsTable}>
        <thead>
          <tr>
            <th>Grupo</th>
            <th>Vehículos activos</th>
            <th>Distancia</th>
            <th>Eventos</th>
            <th>Eventos / 100km</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRowComp
              key={g.groupId}
              g={g}
              maxKm={maxKm}
              maxRatio={maxRatio}
              isBest={g.groupId === bestGroupId && groups.length > 1}
              isWorst={g.groupId === worstGroupId}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function GroupRowComp({
  g,
  maxKm,
  maxRatio,
  isBest,
  isWorst,
}: {
  g: GroupRow;
  maxKm: number;
  maxRatio: number;
  isBest: boolean;
  isWorst: boolean;
}) {
  const kmPct = (g.distanceKm / maxKm) * 100;
  const ratioPct = (g.eventsPer100km / maxRatio) * 100;

  return (
    <tr>
      <td>
        <span className={styles.groupName}>{g.groupName}</span>
        {isBest && <span className={styles.badgeBest}>Mejor del período</span>}
        {isWorst && <span className={styles.badgeWorst}>Atención</span>}
      </td>
      <td className={styles.statValue}>
        {g.assetCount.toLocaleString("es-AR")}
      </td>
      <td className={styles.statValue}>
        <span className={styles.barCellWrap}>
          <span className={styles.barCellTrack}>
            <span
              className={styles.barCellFillSelf}
              style={{ width: `${kmPct}%` }}
            />
          </span>
          <span className={styles.barCellValue}>
            {g.distanceKm.toLocaleString("es-AR", { maximumFractionDigits: 0 })} km
          </span>
        </span>
      </td>
      <td className={styles.statValue}>
        {g.eventCount.toLocaleString("es-AR")}
      </td>
      <td className={styles.statValue}>
        <span className={styles.barCellWrap}>
          <span className={styles.barCellTrack}>
            <span
              className={`${styles.barCellFill} ${isWorst ? styles.barCellFillBad : ""}`}
              style={{ width: `${ratioPct}%` }}
            />
          </span>
          <span className={styles.barCellValue}>
            {g.eventsPer100km.toLocaleString("es-AR", {
              maximumFractionDigits: 2,
            })}
          </span>
        </span>
      </td>
    </tr>
  );
}
