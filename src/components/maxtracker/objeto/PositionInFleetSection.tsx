import type { DriverPeersResult } from "@/lib/queries/driver-peers";
import { PositionInGroupScatter } from "@/components/maxtracker/objeto/PositionInGroupScatter";
import styles from "./PositionInGroupSection.module.css";

// ═══════════════════════════════════════════════════════════════
//  PositionInFleetSection · S2-L7
//  ─────────────────────────────────────────────────────────────
//  Posición del conductor entre todos los conductores activos
//  del account, en el período del Libro. Reusa el scatter genérico
//  PositionInGroupScatter cambiando solo la prosa del header.
//
//  Métricas:
//    1. Distancia × Safety score (Person.safetyScore directo)
//    2. Distancia × Eventos cada 100km
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: DriverPeersResult;
}

export function PositionInFleetSection({ data }: Props) {
  if (data.peers.length < 2) return null;

  const distVsSafety = data.peers.map((p) => ({
    id: p.id,
    name: p.name,
    plate: p.plate,
    x: p.distanceKm,
    y: p.safetyScore,
  }));

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
        <h3 className={styles.heading}>Posición en la flota</h3>
        <p className={styles.subtitle}>
          Cómo se compara este conductor con los demás de{" "}
          <strong>{data.accountName}</strong> ({data.peers.length}{" "}
          {data.peers.length === 1 ? "conductor activo" : "conductores activos"}
          ).
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
          subtitle="Más arriba a la derecha es mejor · mucho km con buen score"
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
          subtitle="Más a la derecha y abajo es mejor · mucho km con pocos eventos"
        />
      </div>
    </section>
  );
}
