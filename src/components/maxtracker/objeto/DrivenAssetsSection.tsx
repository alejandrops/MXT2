import Link from "next/link";
import { db } from "@/lib/db";
import styles from "./CompositionSection.module.css";

// ═══════════════════════════════════════════════════════════════
//  DrivenAssetsSection · vehículos asignados al conductor
//  ─────────────────────────────────────────────────────────────
//  Lista los vehículos que tienen a este conductor como
//  currentDriverId · típicamente 1, ocasionalmente 2-3 si el
//  conductor cubre turnos en varios vehículos.
//
//  Por cada vehículo · patente, status, km del período, eventos
//  del período, alarmas activas · todos linkean al Libro vehículo.
// ═══════════════════════════════════════════════════════════════

interface Props {
  personId: string;
  fromDate: string;
  toDate: string;
}

export async function DrivenAssetsSection({
  personId,
  fromDate,
  toDate,
}: Props) {
  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  const assets = await db.asset.findMany({
    where: { currentDriverId: personId },
    select: {
      id: true,
      name: true,
      plate: true,
      status: true,
      group: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  if (assets.length === 0) {
    return (
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Vehículos asignados</h2>
        </header>
        <p className={styles.empty}>
          Este conductor no tiene vehículos asignados actualmente.
        </p>
      </section>
    );
  }

  // Stats por asset · km y eventos del período
  const assetIds = assets.map((a) => a.id);

  const [days, eventCounts, openAlarmCounts] = await Promise.all([
    db.assetDriverDay.findMany({
      where: {
        assetId: { in: assetIds },
        personId,
        day: { gte: fromDt, lt: toDt },
      },
      select: { assetId: true, distanceKm: true },
    }),
    db.event.groupBy({
      by: ["assetId"],
      where: {
        assetId: { in: assetIds },
        personId,
        occurredAt: { gte: fromDt, lt: toDt },
        type: { notIn: ["IGNITION_ON", "IGNITION_OFF"] },
      },
      _count: { _all: true },
    }),
    db.alarm.groupBy({
      by: ["assetId"],
      where: { assetId: { in: assetIds }, status: "OPEN" },
      _count: { _all: true },
    }),
  ]);

  const kmByAsset = new Map<string, number>();
  for (const d of days) {
    kmByAsset.set(d.assetId, (kmByAsset.get(d.assetId) ?? 0) + (d.distanceKm ?? 0));
  }
  const eventsByAsset = new Map<string, number>();
  for (const e of eventCounts) {
    eventsByAsset.set(e.assetId, e._count._all);
  }
  const alarmsByAsset = new Map<string, number>();
  for (const a of openAlarmCounts) {
    alarmsByAsset.set(a.assetId, a._count._all);
  }

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          Vehículos asignados · {assets.length}
        </h2>
        <span className={styles.sectionHint}>
          conductor activo en estos vehículos
        </span>
      </header>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Vehículo</th>
            <th>Patente</th>
            <th>Grupo</th>
            <th>Status</th>
            <th>Km del período</th>
            <th>Eventos</th>
            <th>Alarmas activas</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => {
            const km = kmByAsset.get(a.id) ?? 0;
            const events = eventsByAsset.get(a.id) ?? 0;
            const openAlarms = alarmsByAsset.get(a.id) ?? 0;
            return (
              <tr key={a.id}>
                <td>
                  <Link
                    href={`/objeto/vehiculo/${a.id}`}
                    className={styles.link}
                  >
                    {a.name}
                  </Link>
                </td>
                <td className={styles.mono}>{a.plate ?? "—"}</td>
                <td className={styles.dim}>{a.group?.name ?? "—"}</td>
                <td>
                  <span className={`${styles.statusPill} ${statusClass(a.status)}`}>
                    {humanStatus(a.status)}
                  </span>
                </td>
                <td className={styles.num}>
                  {km.toLocaleString("es-AR", { maximumFractionDigits: 0 })} km
                </td>
                <td className={styles.num}>{events.toLocaleString("es-AR")}</td>
                <td className={`${styles.num} ${openAlarms > 0 ? styles.alarmHot : ""}`}>
                  {openAlarms > 0 ? openAlarms : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function humanStatus(s: string): string {
  const map: Record<string, string> = {
    MOVING: "En movimiento",
    IDLE: "Ralentí",
    STOPPED: "Detenido",
    OFFLINE: "Sin reportar",
    MAINTENANCE: "Mantenimiento",
  };
  return map[s] ?? s;
}

function statusClass(s: string): string {
  // CSS modules con `noUncheckedIndexedAccess` retornan string|undefined.
  // Las clases status* están definidas en el .module.css · non-null assertion.
  if (s === "MOVING") return styles.statusMoving!;
  if (s === "IDLE") return styles.statusIdle!;
  if (s === "STOPPED") return styles.statusStopped!;
  if (s === "OFFLINE") return styles.statusOffline!;
  if (s === "MAINTENANCE") return styles.statusMaintenance!;
  return styles.statusOffline!;
}
