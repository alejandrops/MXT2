import type { BoletinData } from "@/app/(product)/direccion/boletin/[period]/page";
import { KpiCard } from "@/components/maxtracker/ui";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque A · Resumen ejecutivo
//  ─────────────────────────────────────────────────────────────
//  KPIs principales del mes con delta vs mes anterior.
//  Es el primer bloque que ve el lector · da el panorama general
//  en 5 segundos · invita a seguir leyendo si algo destaca.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: BoletinData;
}

export function BlockA_ResumenEjecutivo({ data }: Props) {
  const { current, previous, fleet } = data;

  const utilizationPct =
    fleet.totalAssets > 0
      ? (current.activeAssetCount / fleet.totalAssets) * 100
      : 0;

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>A</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Resumen ejecutivo</h2>
          <p className={styles.blockHint}>
            Indicadores clave del cierre · variaciones medidas contra el mes
            anterior.
          </p>
        </div>
      </header>

      {/* KPIs · 4 grandes */}
      <div className={styles.kpiGrid}>
        <KpiCard
          size="lg"
          label="Distancia recorrida"
          value={current.distanceKm.toLocaleString("es-AR", {
            maximumFractionDigits: 0,
          })}
          unit="km"
          delta={computeDelta(current.distanceKm, previous.distanceKm)}
          deltaLabel="vs mes anterior"
        />
        <KpiCard
          size="lg"
          label="Horas activas"
          value={fmtHours(current.activeMin)}
          unit="h"
          delta={computeDelta(current.activeMin, previous.activeMin)}
          deltaLabel="vs mes anterior"
        />
        <KpiCard
          size="lg"
          label="Viajes"
          value={current.tripCount.toLocaleString("es-AR")}
          delta={computeDelta(current.tripCount, previous.tripCount)}
          deltaLabel="vs mes anterior"
        />
        <KpiCard
          size="lg"
          label="Eventos relevantes"
          value={current.eventCount.toLocaleString("es-AR")}
          delta={computeDelta(current.eventCount, previous.eventCount)}
          deltaLabel="vs mes anterior"
          isReverseDelta
        />
      </div>

      {/* Línea editorial · contexto narrativo en una línea */}
      <p className={styles.lead}>
        En el período se mantuvo activa una flota de{" "}
        <strong>{current.activeAssetCount.toLocaleString("es-AR")}</strong> de
        un total de{" "}
        <strong>{fleet.totalAssets.toLocaleString("es-AR")}</strong> vehículos
        (utilización {utilizationPct.toFixed(0)}%), con{" "}
        <strong>
          {current.activeDriverCount.toLocaleString("es-AR")}
        </strong>{" "}
        conductores activos y{" "}
        <strong>{current.alarmCount.toLocaleString("es-AR")}</strong> alarmas
        registradas.
      </p>
    </section>
  );
}

function computeDelta(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return (current - prev) / prev;
}

function fmtHours(min: number): string {
  if (min <= 0) return "0";
  return Math.floor(min / 60).toLocaleString("es-AR");
}
