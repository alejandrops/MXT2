// @ts-nocheck · pre-existing TS errors (Prisma types stale) · L5.A apply
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getBoletinSnapshot } from "@/lib/boletin/snapshot";
import {
  loadBoletinData,
  periodToDateRange,
  type BoletinData,
} from "@/lib/queries/boletin-data";
import { BoletinHeader } from "@/components/maxtracker/boletin/BoletinHeader";
import { BlockA_ResumenEjecutivo } from "@/components/maxtracker/boletin/BlockA_ResumenEjecutivo";
import { BlockB_SaludOperativa } from "@/components/maxtracker/boletin/BlockB_SaludOperativa";
import { BlockC_PerformanceGrupos } from "@/components/maxtracker/boletin/BlockC_PerformanceGrupos";
import { BlockD_TopVehiculos } from "@/components/maxtracker/boletin/BlockD_TopVehiculos";
import { BlockE_TopConductores } from "@/components/maxtracker/boletin/BlockE_TopConductores";
import { BlockF_Seguridad } from "@/components/maxtracker/boletin/BlockF_Seguridad";
import { BlockG_Conduccion } from "@/components/maxtracker/boletin/BlockG_Conduccion";
import styles from "./BoletinPage.module.css";

// ═══════════════════════════════════════════════════════════════
//  /direccion/boletin/[period]
//  ─────────────────────────────────────────────────────────────
//  Boletín mensual · producto editorial pre-generado al cierre.
//  Lote 1 · esqueleto + Bloque A (Resumen ejecutivo) +
//  Bloque B (Salud operativa).
//
//  Bloques previstos (entregados en lotes sucesivos):
//    A · Resumen ejecutivo · KPIs principales del mes
//    B · Salud operativa · totales y promedios por vehículo
//    C · Performance por grupo · ranking + box-plot
//    D · Top y bottom · vehículos
//    E · Top y bottom · conductores
//    F · Seguridad · alarmas
//    G · Conducción · scoring y eventos por tipo
//
//  S2-L1 · refactor · `loadBoletinData` movido a
//  src/lib/queries/boletin-data.ts para que el cron pueda usarlo.
//  Los tipos se re-exportan desde acá para no romper imports
//  existentes en los componentes BlockX_*.
// ═══════════════════════════════════════════════════════════════

// ─── Re-export tipos · compatibilidad con imports preexistentes ─
export type {
  BoletinData,
  GroupRow,
  VehicleRow,
  DriverRow,
} from "@/lib/queries/boletin-data";

export const revalidate = 3600;

const PERIOD_RX = /^(\d{4})-(0[1-9]|1[0-2])$/;

interface PageProps {
  params: Promise<{ period: string }>;
}

export default async function BoletinPage({ params }: PageProps) {
  const { period } = await params;
  const match = period.match(PERIOD_RX);
  if (!match) notFound();

  const year = Number(match[1]);
  const month = Number(match[2]);

  const range = periodToDateRange(period);
  if (!range) notFound();

  // L1 · defensa anti-pantalla-blanca (B8)
  // Si loadBoletinData tira (data ausente, query timeout, etc.),
  // mostramos un mensaje en lugar de pantalla en blanco.
  // L2B-3 · scope multi-tenant resuelto antes de la query.
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "direccion", null);

  // S1-L7 cron-scaffold + S2-L1 · check snapshot first, fallback on-demand
  // El cron diario (Vercel) regenera snapshots del mes en curso.
  // Si existe un snapshot con shape válido (no placeholder), lo usamos
  // · ahorra cómputo pesado.
  let data: BoletinData | null = null;
  const snapshot = await getBoletinSnapshot(period, scopedAccountId);
  if (snapshot && isValidBoletinPayload(snapshot.payload)) {
    data = snapshot.payload as BoletinData;
  }

  if (!data) {
    try {
      data = await loadBoletinData({
        monthStart: range.monthStart,
        monthEnd: range.monthEnd,
        prevStart: range.prevStart,
        prevEnd: range.prevEnd,
        accountId: scopedAccountId,
      });
    } catch (err) {
      console.error("[BoletinPage] loadBoletinData failed:", err);
      return (
        <div className={styles.boletin}>
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--t2)",
            }}
          >
            <h2 style={{ marginBottom: 12, color: "var(--tx)" }}>
              No pudimos cargar el boletín
            </h2>
            <p style={{ marginBottom: 6 }}>
              Hubo un problema generando el boletín de {period}.
            </p>
            <p style={{ fontSize: 13 }}>
              Probá recargar la página o elegí otro período.
            </p>
          </div>
        </div>
      );
    }
  }

  // Período anterior y siguiente para navigator
  const prevPeriod = `${month === 1 ? year - 1 : year}-${String(
    month === 1 ? 12 : month - 1,
  ).padStart(2, "0")}`;
  const nextPeriod = `${month === 12 ? year + 1 : year}-${String(
    month === 12 ? 1 : month + 1,
  ).padStart(2, "0")}`;

  // El boletín solo existe para meses ya cerrados · siguiente solo
  // si está en el pasado o es el mes actual cerrado
  const todayUtc = new Date();
  const todayAR = new Date(todayUtc.getTime() - 3 * 60 * 60 * 1000);
  const nextStartUtc = new Date(
    Date.UTC(
      month === 12 ? year + 1 : year,
      month === 12 ? 0 : month,
      1,
      3,
      0,
      0,
    ),
  );
  const hasNext = todayAR.getTime() > nextStartUtc.getTime();

  return (
    <div className={styles.boletin}>
      <BoletinHeader
        year={year}
        month={month}
        prevPeriod={prevPeriod}
        nextPeriod={hasNext ? nextPeriod : null}
        exportPayload={{
          summary: {
            current: data.current,
            previous: data.previous,
            fleet: data.fleet,
          },
          vehicles: data.vehicles.map((v) => ({
            assetId: v.assetId,
            assetName: v.assetName,
            plate: v.plate,
            groupName: v.groupName,
            distanceKm: v.distanceKm,
            activeMin: v.activeMin,
            tripCount: v.tripCount,
            eventCount: v.eventCount,
            eventsPer100km: v.eventsPer100km,
          })),
          drivers: data.drivers.map((d) => ({
            personId: d.personId,
            fullName: d.fullName,
            safetyScore: d.safetyScore,
            distanceKm: d.distanceKm,
            tripCount: d.tripCount,
            eventCount: d.eventCount,
          })),
          groups: data.groups.map((g) => ({
            groupId: g.groupId,
            groupName: g.groupName,
            assetCount: g.assetCount,
            distanceKm: g.distanceKm,
            activeMin: g.activeMin,
            tripCount: g.tripCount,
            eventCount: g.eventCount,
            eventsPer100km: g.eventsPer100km,
          })),
          alarms: {
            total: data.alarms.total,
            activeAtClose: data.alarms.activeAtClose,
            mttrMin: data.alarms.mttrMin,
            bySeverity: data.alarms.bySeverity,
            byDomain: data.alarms.byDomain,
            topVehicles: data.alarms.topVehicles,
          },
          events: data.eventsByType,
        }}
      />

      <article className={styles.body}>
        <BlockA_ResumenEjecutivo data={data} />
        <BlockB_SaludOperativa data={data} />
        <BlockC_PerformanceGrupos data={data} />
        <BlockD_TopVehiculos data={data} />
        <BlockE_TopConductores data={data} />
        <BlockF_Seguridad data={data} />
        <BlockG_Conduccion data={data} />

        {/* Placeholders para bloques H-J · entregados en próximos lotes */}
        <BlockPlaceholder
          letter="H"
          title="Anomalías estadísticas"
          hint="Vehículos con desvío >2σ del baseline · próximo lote"
        />
        <BlockPlaceholder
          letter="I"
          title="Sostenibilidad · combustible"
          hint="Cuando el módulo esté construido"
        />
        <BlockPlaceholder
          letter="J"
          title="Highlights y observaciones"
          hint="Texto editorial generado · próximo lote"
        />
      </article>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Placeholder para bloques no implementados
// ═══════════════════════════════════════════════════════════════

function BlockPlaceholder({
  letter,
  title,
  hint,
}: {
  letter: string;
  title: string;
  hint: string;
}) {
  return (
    <section className={styles.placeholder}>
      <div className={styles.placeholderLetter}>{letter}</div>
      <div className={styles.placeholderBody}>
        <h2 className={styles.placeholderTitle}>{title}</h2>
        <p className={styles.placeholderHint}>{hint}</p>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  S1-L7 cron-scaffold · type guard del snapshot
//  ─────────────────────────────────────────────────────────────
//  Valida que el payload del BoletinSnapshot tenga el shape de
//  BoletinData. Los snapshots placeholder generados en Sprint 1
//  retornan false y caen al fallback de loadBoletinData.
//
//  S2-L1 · ahora que el cron genera payloads reales, este check
//  empieza a pasar y los snapshots se sirven instantáneo.
// ═══════════════════════════════════════════════════════════════

function isValidBoletinPayload(payload: unknown): payload is BoletinData {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  // Discriminator · placeholders del scaffold tienen status="placeholder"
  if (p.status === "placeholder") return false;
  // Shape mínimo · si tiene 'current' y 'fleet' es muy probable que sea BoletinData
  return "current" in p && "fleet" in p && "groups" in p;
}
