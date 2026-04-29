import Link from "next/link";
import { db } from "@/lib/db";
import styles from "./CompositionSection.module.css";

// ═══════════════════════════════════════════════════════════════
//  GroupCompositionSection · vehículos y conductores del grupo
//  ─────────────────────────────────────────────────────────────
//  Lista los vehículos del grupo con sus stats del período +
//  los conductores únicos asignados a esos vehículos.
//
//  Se muestra al inicio del tab Actividad cuando type=grupo.
// ═══════════════════════════════════════════════════════════════

interface Props {
  groupId: string;
  fromDate: string;
  toDate: string;
}

export async function GroupCompositionSection({
  groupId,
  fromDate,
  toDate,
}: Props) {
  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  const assets = await db.asset.findMany({
    where: { groupId },
    select: {
      id: true,
      name: true,
      plate: true,
      status: true,
      currentDriver: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { name: "asc" },
  });

  if (assets.length === 0) {
    return (
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Vehículos del grupo</h2>
        </header>
        <p className={styles.empty}>
          Este grupo no tiene vehículos asignados.
        </p>
      </section>
    );
  }

  const assetIds = assets.map((a) => a.id);

  const [days, eventCounts, openAlarmCounts] = await Promise.all([
    db.assetDriverDay.findMany({
      where: {
        assetId: { in: assetIds },
        day: { gte: fromDt, lt: toDt },
      },
      select: { assetId: true, distanceKm: true },
    }),
    db.event.groupBy({
      by: ["assetId"],
      where: {
        assetId: { in: assetIds },
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

  // Conductores únicos
  const driversMap = new Map<
    string,
    { id: string; fullName: string; assetCount: number }
  >();
  for (const a of assets) {
    if (a.currentDriver) {
      const cur = driversMap.get(a.currentDriver.id) ?? {
        id: a.currentDriver.id,
        fullName: `${a.currentDriver.firstName} ${a.currentDriver.lastName}`.trim(),
        assetCount: 0,
      };
      cur.assetCount += 1;
      driversMap.set(a.currentDriver.id, cur);
    }
  }
  const uniqueDrivers = Array.from(driversMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );

  return (
    <>
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Vehículos del grupo · {assets.length}
          </h2>
        </header>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Patente</th>
              <th>Conductor activo</th>
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
              const driver = a.currentDriver
                ? `${a.currentDriver.firstName} ${a.currentDriver.lastName}`.trim()
                : null;
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
                  <td>
                    {a.currentDriver ? (
                      <Link
                        href={`/objeto/conductor/${a.currentDriver.id}`}
                        className={styles.link}
                      >
                        {driver}
                      </Link>
                    ) : (
                      <span className={styles.dim}>Sin asignar</span>
                    )}
                  </td>
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

      {uniqueDrivers.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Conductores · {uniqueDrivers.length}
            </h2>
            <span className={styles.sectionHint}>
              asignados a vehículos de este grupo
            </span>
          </header>

          <ul className={styles.driverList}>
            {uniqueDrivers.map((d) => (
              <li key={d.id} className={styles.driverItem}>
                <Link
                  href={`/objeto/conductor/${d.id}`}
                  className={styles.link}
                >
                  {d.fullName}
                </Link>
                <span className={styles.driverMeta}>
                  · {d.assetCount}{" "}
                  {d.assetCount === 1 ? "vehículo" : "vehículos"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers · idénticos a los del DrivenAssetsSection
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
  if (s === "MOVING") return styles.statusMoving;
  if (s === "IDLE") return styles.statusIdle;
  if (s === "STOPPED") return styles.statusStopped;
  if (s === "OFFLINE") return styles.statusOffline;
  if (s === "MAINTENANCE") return styles.statusMaintenance;
  return styles.statusOffline;
}
