import type { BoletinData, DriverRow } from "@/app/(product)/direccion/boletin/[period]/page";
import Link from "next/link";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque E · Top y bottom · conductores
//  ─────────────────────────────────────────────────────────────
//  Driver scorecard del mes · 5 mejores y 5 peores por safetyScore.
//
//  El safetyScore es el campo derivado de Person · refleja el
//  performance histórico del conductor (rolling). Para el boletín
//  mensual lo mostramos como referencia · acompañado de los datos
//  del período (km, eventos) para dar contexto.
//
//  Filtro · solo conductores con actividad mínima en el período
//  (>1 viaje) · evita rankear a conductores que estuvieron de
//  licencia o no manejaron.
// ═══════════════════════════════════════════════════════════════

const MIN_TRIPS_FOR_RANKING = 1;
const TOP_N = 5;

interface Props {
  data: BoletinData;
}

export function BlockE_TopConductores({ data }: Props) {
  const eligible = data.drivers.filter(
    (d) => d.tripCount >= MIN_TRIPS_FOR_RANKING,
  );

  // Ordenamos por score · más alto = mejor
  const sorted = [...eligible].sort((a, b) => b.safetyScore - a.safetyScore);

  const top = sorted.slice(0, TOP_N);
  const bottom = sorted.slice(-TOP_N).reverse(); // peor primero

  const empty = top.length === 0 && bottom.length === 0;

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>E</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Top y bottom · conductores</h2>
          <p className={styles.blockHint}>
            Driver scorecard · safety score (0 = peor · 100 = mejor) · solo
            conductores que manejaron en el período · click en el nombre para
            ver el Libro del Objeto.
          </p>
        </div>
      </header>

      {empty ? (
        <p className={styles.empty}>
          No hay conductores con actividad para rankear.
        </p>
      ) : (
        <div className={styles.topBottomGrid}>
          <div>
            <h3 className={styles.subsectionTitle}>
              Mejores · {top.length}
            </h3>
            <DriverList items={top} mode="top" />
          </div>
          <div>
            <h3 className={styles.subsectionTitle}>
              Peores · {bottom.length}
            </h3>
            <DriverList items={bottom} mode="bottom" />
          </div>
        </div>
      )}
    </section>
  );
}

function DriverList({
  items,
  mode,
}: {
  items: DriverRow[];
  mode: "top" | "bottom";
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>Sin datos.</p>;
  }
  return (
    <ol className={styles.rankList}>
      {items.map((d, i) => (
        <li key={d.personId} className={styles.rankRow}>
          <span className={styles.rankNum}>{i + 1}</span>
          <span className={styles.rankPrimary}>
            <Link
              href={`/objeto/conductor/${d.personId}`}
              className={styles.rankLink}
            >
              {d.fullName}
            </Link>
            <span className={styles.rankSec}>
              {d.distanceKm.toLocaleString("es-AR", {
                maximumFractionDigits: 0,
              })}{" "}
              km · {d.tripCount} viajes · {d.eventCount} eventos
            </span>
          </span>
          <span className={styles.rankValue}>
            <span
              className={mode === "top" ? styles.scoreGood : styles.scoreBad}
            >
              {d.safetyScore}
            </span>
            <span className={styles.rankUnit}>safety score</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
