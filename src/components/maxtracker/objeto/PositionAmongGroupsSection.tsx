import type { GroupSiblingsResult } from "@/lib/queries/group-siblings";
import { PositionInGroupScatter } from "@/components/maxtracker/objeto/PositionInGroupScatter";
import styles from "./PositionInGroupSection.module.css";

// ═══════════════════════════════════════════════════════════════
//  PositionAmongGroupsSection · S2-L7
//  ─────────────────────────────────────────────────────────────
//  Posición del grupo entre todos los grupos del mismo account.
//  Permite ver cómo performa este grupo vs los otros del cliente.
//
//  Tamaño del punto · podríamos modular por assetCount, pero el
//  scatter genérico no soporta esa prop · se deja como mejora
//  futura. Por ahora, el activo se destaca por color como en los
//  otros scatters.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: GroupSiblingsResult;
}

export function PositionAmongGroupsSection({ data }: Props) {
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
        <h3 className={styles.heading}>Posición entre grupos</h3>
        <p className={styles.subtitle}>
          Cómo se compara este grupo con los demás de{" "}
          <strong>{data.accountName}</strong> ({data.peers.length}{" "}
          {data.peers.length === 1 ? "grupo" : "grupos"}).
        </p>
      </header>

      <div className={styles.grid}>
        <PositionInGroupScatter
          points={distVsSafety}
          activeId={data.activeId}
          xLabel="Distancia total"
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
          xLabel="Distancia total"
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
