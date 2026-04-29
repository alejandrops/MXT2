import type { BoletinData, VehicleRow } from "@/app/(product)/direccion/boletin/[period]/page";
import Link from "next/link";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque D · Top y bottom · vehículos
//  ─────────────────────────────────────────────────────────────
//  5 mejores y 5 peores vehículos del período según eventos / 100km.
//
//  Filtro de relevancia · solo entran al ranking vehículos con
//  cierta actividad mínima (>50 km en el período) · sin esto
//  un vehículo que recorrió 2 km y tuvo 1 evento dispararía
//  la lista de peores con un ratio infinito.
//
//  El nombre de cada vehículo linkea al Libro del Objeto · el
//  director puede hacer drill-down desde el boletín al detalle.
// ═══════════════════════════════════════════════════════════════

const MIN_KM_FOR_RANKING = 50;
const TOP_N = 5;

interface Props {
  data: BoletinData;
}

export function BlockD_TopVehiculos({ data }: Props) {
  const eligible = data.vehicles.filter(
    (v) => v.distanceKm >= MIN_KM_FOR_RANKING,
  );

  // Ordenamos por calidad · menos eventos/100km = mejor
  const sorted = [...eligible].sort(
    (a, b) => a.eventsPer100km - b.eventsPer100km,
  );

  const top = sorted.slice(0, TOP_N);
  const bottom = sorted.slice(-TOP_N).reverse(); // peor primero

  const empty = top.length === 0 && bottom.length === 0;

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>D</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Top y bottom · vehículos</h2>
          <p className={styles.blockHint}>
            Ranking por eventos cada 100 km · solo vehículos con más de{" "}
            {MIN_KM_FOR_RANKING} km en el período · click en el nombre para
            ver el Libro del Objeto.
          </p>
        </div>
      </header>

      {empty ? (
        <p className={styles.empty}>
          No hay vehículos con suficiente actividad para rankear (mínimo{" "}
          {MIN_KM_FOR_RANKING} km).
        </p>
      ) : (
        <div className={styles.topBottomGrid}>
          <div>
            <h3 className={styles.subsectionTitle}>
              Mejores · {top.length}
            </h3>
            <RankList items={top} mode="top" />
          </div>
          <div>
            <h3 className={styles.subsectionTitle}>
              Peores · {bottom.length}
            </h3>
            <RankList items={bottom} mode="bottom" />
          </div>
        </div>
      )}
    </section>
  );
}

function RankList({
  items,
  mode,
}: {
  items: VehicleRow[];
  mode: "top" | "bottom";
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>Sin datos.</p>;
  }
  return (
    <ol className={styles.rankList}>
      {items.map((v, i) => (
        <li key={v.assetId} className={styles.rankRow}>
          <span className={styles.rankNum}>{i + 1}</span>
          <span className={styles.rankPrimary}>
            <Link
              href={`/objeto/vehiculo/${v.assetId}`}
              className={styles.rankLink}
            >
              {v.assetName}
            </Link>
            {v.plate && <span className={styles.rankPlate}>{v.plate}</span>}
            {v.groupName && (
              <span className={styles.rankSec}>{v.groupName}</span>
            )}
          </span>
          <span className={styles.rankValue}>
            <span
              className={mode === "top" ? styles.rankGood : styles.rankBad}
            >
              {v.eventsPer100km.toLocaleString("es-AR", {
                maximumFractionDigits: 2,
              })}
            </span>
            <span className={styles.rankUnit}>ev / 100km</span>
            <span className={styles.rankAux}>
              {v.distanceKm.toLocaleString("es-AR", {
                maximumFractionDigits: 0,
              })}{" "}
              km · {v.eventCount} ev
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
