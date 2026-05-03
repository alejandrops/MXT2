import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import {
  getDriverAssetList,
  getDriverAssetWeeklyHeatmap,
} from "@/lib/queries";
import { SectionHeader } from "./SectionHeader";
import { DriverAssetsHeatmap } from "./DriverAssetsHeatmap";
import styles from "./DriverAssetsPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverAssetsPanel · Tab "Vehículos manejados" del Conductor 360
//  ─────────────────────────────────────────────────────────────
//  Espejo del AssetDriversPanel pivoteado al person:
//    1. Tabla densa de assets que manejó (orden: more-driven first)
//    2. Heatmap semanal · 1 fila por asset × ~53 semanas
// ═══════════════════════════════════════════════════════════════

export async function DriverAssetsPanel({
  personId,
}: {
  personId: string;
}) {
  const [assets, heatmap] = await Promise.all([
    getDriverAssetList(personId),
    getDriverAssetWeeklyHeatmap(personId),
  ]);

  if (assets.length === 0) {
    return (
      <div className={styles.empty}>
        Aún no hay vehículos manejados por este conductor · se llenará cuando
        entren los primeros viajes con asignación.
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* ── Tabla de vehículos ────────────────────────────── */}
      <section className={styles.section}>
        <SectionHeader
          title="Vehículos manejados"
          count={assets.length}
        />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Vehículo</th>
                <th className={styles.th}>Patente</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Días</th>
                <th className={`${styles.th} ${styles.alignRight}`}>
                  Viajes
                </th>
                <th className={`${styles.th} ${styles.alignRight}`}>Km</th>
                <th className={styles.th}>Última jornada</th>
                <th className={styles.thAction} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const href = `/objeto/vehiculo/${a.assetId}`;
                return (
                  <tr key={a.assetId} className={styles.row}>
                    <Cell href={href}>
                      <div className={styles.assetCell}>
                        {a.isMostDriven && (
                          <Star
                            size={11}
                            className={styles.mostDrivenIcon}
                            aria-label="Más manejado"
                          />
                        )}
                        <span className={styles.assetName}>{a.assetName}</span>
                      </div>
                    </Cell>
                    <Cell href={href}>
                      {a.assetPlate ? (
                        <span className={styles.plate}>{a.assetPlate}</span>
                      ) : (
                        <span className={styles.dim}>—</span>
                      )}
                    </Cell>
                    <Cell href={href} align="right">
                      <span className={styles.mono}>{a.totalDays}</span>
                    </Cell>
                    <Cell href={href} align="right">
                      <span className={styles.mono}>{a.totalTrips}</span>
                    </Cell>
                    <Cell href={href} align="right">
                      <span className={styles.mono}>
                        {a.totalKm.toLocaleString("es-AR", {
                          maximumFractionDigits: 1,
                        })}
                      </span>
                    </Cell>
                    <Cell href={href}>
                      <span className={styles.dim}>
                        {formatDateAr(a.lastDay)}
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
        <SectionHeader title="Actividad semanal por vehículo · 12 meses" />
        {heatmap.weeks.length === 0 || heatmap.maxWeekKm === 0 ? (
          <div className={styles.emptyHeatmap}>
            Sin datos suficientes para el heatmap.
          </div>
        ) : (
          <DriverAssetsHeatmap data={heatmap} />
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

function formatDateAr(d: Date): string {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const day = String(local.getUTCDate()).padStart(2, "0");
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const y = String(local.getUTCFullYear()).slice(2);
  return `${day}/${m}/${y}`;
}
