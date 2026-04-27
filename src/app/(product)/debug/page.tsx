import { db } from "@/lib/db";
import { getSafetyKpis } from "@/lib/queries";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /debug · Seed verification page
//  ─────────────────────────────────────────────────────────────
//  Shows entity counts, KPI rollups, and sample rows so we can
//  verify the seed produced coherent data. Not a real product
//  surface — purely diagnostic.
//
//  Force dynamic so we always read fresh DB state during dev.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  const [
    counts,
    kpis,
    accounts,
    sampleAssets,
    sampleAlarms,
  ] = await Promise.all([
    getCounts(),
    getSafetyKpis(),
    db.account.findMany({
      include: {
        _count: {
          select: {
            assets: true,
            persons: true,
            groups: true,
            alarms: true,
          },
        },
      },
    }),
    db.asset.findMany({
      take: 8,
      orderBy: { name: "asc" },
      include: {
        group: { select: { name: true } },
        account: { select: { name: true } },
        currentDriver: { select: { firstName: true, lastName: true } },
      },
    }),
    db.alarm.findMany({
      take: 5,
      orderBy: { triggeredAt: "desc" },
      where: { status: "OPEN" },
      include: {
        asset: { select: { name: true, plate: true } },
        person: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Debug · Seed verification</h1>
        <p className={styles.subtitle}>
          Sub-lote 1.2 · Datos coherentes generados desde <code>prisma/seed.ts</code>
        </p>
      </header>

      {/* ── Entity counts ─────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Entity counts</h2>
        <div className={styles.kpiGrid}>
          <CountTile label="Organizations" value={counts.org} />
          <CountTile label="Accounts" value={counts.acc} />
          <CountTile label="Groups" value={counts.grp} />
          <CountTile label="Persons" value={counts.per} />
          <CountTile label="Assets" value={counts.ast} />
          <CountTile label="Devices" value={counts.dev} />
          <CountTile label="Positions" value={counts.pos} />
          <CountTile label="Events" value={counts.evt} />
          <CountTile label="Alarms" value={counts.alm} />
        </div>
      </section>

      {/* ── Safety KPIs (from query layer) ────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Safety KPIs (Dashboard D preview)</h2>
        <div className={styles.kpiGrid}>
          <CountTile label="Alarmas activas" value={kpis.openAlarmsCount} accent="red" />
          <CountTile label="Assets críticos" value={kpis.criticalAssetsCount} accent="red" />
          <CountTile label="Eventos 24h" value={kpis.events24hCount} accent="amb" />
          <CountTile label="Safety score flota" value={kpis.fleetSafetyScore} accent="grn" />
        </div>
      </section>

      {/* ── Account distribution ──────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Account distribution</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Account</th>
              <th>Industry</th>
              <th>Tier</th>
              <th className={styles.num}>Groups</th>
              <th className={styles.num}>Persons</th>
              <th className={styles.num}>Assets</th>
              <th className={styles.num}>Alarms</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td className={styles.dim}>{a.industry}</td>
                <td>
                  <span className={styles.pill}>{a.tier}</span>
                </td>
                <td className={styles.num}>{a._count.groups}</td>
                <td className={styles.num}>{a._count.persons}</td>
                <td className={styles.num}>{a._count.assets}</td>
                <td className={styles.num}>{a._count.alarms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Sample assets ─────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Sample assets</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Plate</th>
              <th>Account</th>
              <th>Group</th>
              <th>Mobility</th>
              <th>Status</th>
              <th>Driver</th>
            </tr>
          </thead>
          <tbody>
            {sampleAssets.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td className={styles.mono}>{a.plate ?? "—"}</td>
                <td className={styles.dim}>{a.account.name}</td>
                <td className={styles.dim}>{a.group?.name ?? "—"}</td>
                <td>
                  <span className={styles.pillSm}>{a.mobilityType}</span>
                </td>
                <td>
                  <span className={`${styles.pillSm} ${styles[`status_${a.status}`] ?? ""}`}>
                    {a.status}
                  </span>
                </td>
                <td className={styles.dim}>
                  {a.currentDriver
                    ? `${a.currentDriver.firstName} ${a.currentDriver.lastName}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Sample open alarms ────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Sample open alarms</h2>
        {sampleAlarms.length === 0 ? (
          <p className={styles.dim}>No hay alarmas abiertas.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Triggered</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Asset</th>
                <th>Driver</th>
              </tr>
            </thead>
            <tbody>
              {sampleAlarms.map((al) => (
                <tr key={al.id}>
                  <td className={styles.mono}>
                    {al.triggeredAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td>{al.type}</td>
                  <td>
                    <span className={`${styles.pillSm} ${styles[`sev_${al.severity}`] ?? ""}`}>
                      {al.severity}
                    </span>
                  </td>
                  <td>
                    {al.asset.name}{" "}
                    {al.asset.plate && (
                      <span className={styles.mono}>· {al.asset.plate}</span>
                    )}
                  </td>
                  <td className={styles.dim}>
                    {al.person
                      ? `${al.person.firstName} ${al.person.lastName}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className={styles.footer}>
        <p>
          Si los counts no son cero y los samples se ven coherentes,
          <strong> Sub-lote 1.2 está cerrado.</strong>
        </p>
        <p>
          Próximo paso · <strong>Sub-lote 1.3</strong>: Dashboard Patrón D real (en <code>/seguridad</code>).
        </p>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

async function getCounts() {
  const [org, acc, grp, per, ast, dev, pos, evt, alm] = await Promise.all([
    db.organization.count(),
    db.account.count(),
    db.group.count(),
    db.person.count(),
    db.asset.count(),
    db.device.count(),
    db.position.count(),
    db.event.count(),
    db.alarm.count(),
  ]);
  return { org, acc, grp, per, ast, dev, pos, evt, alm };
}

function CountTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "red" | "grn" | "amb";
}) {
  const accentClass = accent ? styles[`accent_${accent}`] : "";
  return (
    <div className={`${styles.tile} ${accentClass}`}>
      <div className={styles.tileVal}>{value.toLocaleString("es-AR")}</div>
      <div className={styles.tileLbl}>{label}</div>
    </div>
  );
}
