import type { GroupPeersResult } from "@/lib/queries/group-peers";
import { PositionInGroupScatter } from "@/components/maxtracker/objeto/PositionInGroupScatter";
import styles from "./PositionInGroupSection.module.css";

// ═══════════════════════════════════════════════════════════════
//  PositionInGroupSection · S1-L4b
//  ─────────────────────────────────────────────────────────────
//  Sección del Libro que muestra el contexto comparativo del
//  objeto vs sus peers del grupo. 2 scatters lado a lado:
//
//    1. Distancia × Seguridad (km recorridos vs safety score)
//    2. Distancia × Eventos (km recorridos vs eventos cada 100km)
//
//  Si el objeto no está en grupo o el grupo tiene 1 solo asset,
//  no se renderiza nada (caller decide).
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: GroupPeersResult;
}

export function PositionInGroupSection({ data }: Props) {
  if (data.peers.length < 2) return null;

  // Mapear a formato del scatter · Distancia × Safety score
  const distVsSafety = data.peers.map((p) => ({
    id: p.id,
    name: p.name,
    plate: p.plate,
    x: p.distanceKm,
    y: p.safetyScore,
  }));

  // Distancia × Eventos cada 100km
  const distVsEvents = data.peers.map((p) => ({
    id: p.id,
    name: p.name,
    plate: p.plate,
    x: p.distanceKm,
    y: p.eventsPer100km,
  }));

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h3 className={styles.heading}>Posición en el grupo</h3>
        <p className={styles.subtitle}>
          Cómo se compara este vehículo con los demás de{" "}
          <strong>{data.groupName}</strong> ({data.peers.length}{" "}
          {data.peers.length === 1 ? "vehículo" : "vehículos"}).
        </p>
      </header>

      <div className={styles.grid}>
        <PositionInGroupScatter
          points={distVsSafety}
          activeId={data.activeId}
          xLabel="Distancia"
          yLabel="Safety score"
          xUnit="km"
          yUnit="/100"
          formatX={(n) => n.toLocaleString("es-AR")}
          formatY={(n) => n.toFixed(0)}
          title="Distancia × Seguridad"
          subtitle="Más arriba a la derecha es mejor · alto km con buen score"
        />

        <PositionInGroupScatter
          points={distVsEvents}
          activeId={data.activeId}
          xLabel="Distancia"
          yLabel="Eventos / 100km"
          xUnit="km"
          formatX={(n) => n.toLocaleString("es-AR")}
          formatY={(n) => n.toFixed(2)}
          title="Distancia × Eventos"
          subtitle="Más a la derecha y abajo es mejor · alto km con pocos eventos"
        />
      </div>
    </section>
  );
}
