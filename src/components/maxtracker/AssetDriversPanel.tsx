import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getAssetDriverList,
  getAssetDriverWeeklyHeatmap,
} from "@/lib/queries";
import { SectionHeader } from "./SectionHeader";
import { AssetDriversHeatmap } from "./AssetDriversHeatmap";
import styles from "./AssetDriversPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetDriversPanel · Tab "Conductor" de la 360 de vehículo
//  ─────────────────────────────────────────────────────────────
//  Server component. Lee de la tabla precalculada AssetDriverDay
//  via getAssetDriverList y getAssetDriverWeeklyHeatmap. NO toca
//  Position.
//
//  Anatomía:
//    1. Tabla densa de choferes que pasaron por el vehículo
//       (orden: actual primero, luego por último contacto desc)
//    2. Heatmap semanal · 1 fila por chofer × 53 semanas
// ═══════════════════════════════════════════════════════════════

export async function AssetDriversPanel({ assetId }: { assetId: string }) {
  const [drivers, heatmap] = await Promise.all([
    getAssetDriverList(assetId),
    getAssetDriverWeeklyHeatmap(assetId),
  ]);

  if (drivers.length === 0) {
    return (
      <div className={styles.empty}>
        Aún no hay conductores registrados para este vehículo · se llenará
        cuando entren los primeros viajes con chofer asignado.
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* ── Tabla de choferes ────────────────────────────── */}
      <section className={styles.section}>
        <SectionHeader
          title="Conductores que pasaron por este vehículo"
          count={drivers.length}
        />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Conductor</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Score</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Días</th>
                <th className={`${styles.th} ${styles.alignRight}`}>
                  Viajes
                </th>
                <th className={`${styles.th} ${styles.alignRight}`}>Km</th>
                <th className={`${styles.th} ${styles.alignRight}`}>
                  Tiempo activo
                </th>
                <th className={styles.th}>Período</th>
                <th className={styles.thAction} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => {
                const href = `/gestion/conductores/${d.personId}`;
                return (
                  <tr key={d.personId} className={styles.row}>
                    <Cell href={href}>
                      <div className={styles.driverCell}>
                        <span className={styles.driverName}>
                          {d.firstName} {d.lastName}
                        </span>
                        {d.isCurrent && (
                          <span className={styles.currentPill}>Actual</span>
                        )}
                      </div>
                    </Cell>
                    <Cell href={href} align="right">
                      <span
                        className={`${styles.score} ${
                          d.safetyScore < 60
                            ? styles.scoreRed
                            : d.safetyScore < 80
                              ? styles.scoreAmb
                              : styles.scoreGrn
                        }`}
                      >
                        {d.safetyScore}
                      </span>
                    </Cell>
                    <Cell href={href} align="right">
                      <span className={styles.mono}>{d.dayCount}</span>
                    </Cell>
                    <Cell href={href} align="right">
                      <span className={styles.mono}>{d.tripCount}</span>
                    </Cell>
                    <Cell href={href} align="right">
                      <span className={styles.mono}>
                        {d.totalKm.toLocaleString("es-AR", {
                          maximumFractionDigits: 1,
                        })}
                      </span>
                    </Cell>
                    <Cell href={href} align="right">
                      <span className={styles.mono}>
                        {formatHours(d.totalActiveMin)}
                      </span>
                    </Cell>
                    <Cell href={href}>
                      <span className={styles.dim}>
                        {formatRange(d.firstDay, d.lastDay)}
                      </span>
                    </Cell>
                    <Cell href={href} align="right">
                      <ChevronRight size={14} className={styles.chev} />
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Heatmap semanal ─────────────────────────────── */}
      <section className={styles.section}>
        <SectionHeader title="Actividad semanal por conductor · 12 meses" />
        {heatmap.weeks.length === 0 || heatmap.maxWeekKm === 0 ? (
          <div className={styles.emptyHeatmap}>
            Sin datos suficientes para el heatmap.
          </div>
        ) : (
          <AssetDriversHeatmap data={heatmap} />
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function Cell({
  href,
  children,
  align,
}: {
  href: string;
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      className={`${styles.td} ${align === "right" ? styles.alignRight : ""}`}
    >
      <Link href={href} className={styles.cellLink}>
        {children}
      </Link>
    </td>
  );
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatRange(first: Date, last: Date): string {
  const f = formatDateAr(first);
  const l = formatDateAr(last);
  if (f === l) return f;
  return `${f} → ${l}`;
}

function formatDateAr(d: Date): string {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const day = String(local.getUTCDate()).padStart(2, "0");
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const y = String(local.getUTCFullYear()).slice(2);
  return `${day}/${m}/${y}`;
}
