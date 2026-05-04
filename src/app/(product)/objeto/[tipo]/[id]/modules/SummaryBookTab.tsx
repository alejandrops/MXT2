// @ts-nocheck · pre-existing patterns (Prisma types stale)
import Link from "next/link";
import { db } from "@/lib/db";
import { AlertTriangle, ChevronRight, MapPin } from "lucide-react";
import { getAssetLiveStatus } from "@/lib/queries/asset-live-status";
import { getAlarmsByAsset } from "@/lib/queries/alarms";
import { getAssetDriverList } from "@/lib/queries/asset-drivers";
import {
  generateCanSnapshot,
  getDeviceCapabilities,
} from "@/lib/mock-can";
import styles from "./SummaryBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  SummaryBookTab · S1-L6 vista-ejecutiva-vehiculo
//  ─────────────────────────────────────────────────────────────
//  Vista ejecutiva del vehículo · "el ahora" cross-módulo.
//  Solo aplica al vehículo · primera tab del Libro (default).
//
//  Estructura:
//    1. Hero state · estado en lenguaje natural
//    2. Conductor actual · si está asignado
//    3. CAN destacado · 4 mini-KPIs si tiene CAN
//    4. KPIs del mes · km, viajes, eventos, idle
//    5. Alarmas activas · top 3 con drill-down
//    6. Atajos · links a las otras tabs
//
//  Filosofía:
//    · Resume todo el cubo en una sola pantalla
//    · Cada sección apunta a su tab/pantalla profunda con ChevronRight
//    · Color solo en anomalías (Tufte) · alarmas, idle alto, fuel bajo
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: "vehiculo" | "conductor" | "grupo";
  id: string;
}

export async function SummaryBookTab({ type, id }: Props) {
  if (type !== "vehiculo") {
    return (
      <div className={styles.empty}>
        <p>El Resumen por ahora solo aplica a vehículos.</p>
      </div>
    );
  }

  const [liveStatus, openAlarms, monthSummary, drivers] = await Promise.all([
    getAssetLiveStatus(id),
    getAlarmsByAsset(id, { status: "OPEN", limit: 3 }),
    getAssetMonthSummary(id),
    getAssetDriverList(id),
  ]);

  if (!liveStatus) {
    return (
      <div className={styles.empty}>
        <p>Vehículo no encontrado.</p>
      </div>
    );
  }

  // CAN snapshot · usa lastPosition si existe
  const speedKmh = liveStatus.lastPosition?.speedKmh ?? 0;
  const ignition = liveStatus.lastPosition?.ignition ?? false;
  const caps = getDeviceCapabilities(id);
  const can = generateCanSnapshot(id, speedKmh, ignition, Date.now());

  // Conductor actual · primero de la lista (most recent + isCurrent)
  const currentDriver = drivers.find((d) => d.isCurrent) ?? drivers[0] ?? null;

  return (
    <div className={styles.body}>
      {/* ── Hero state ────────────────────────────────────── */}
      <HeroState data={liveStatus} />

      {/* ── Grid principal · 2 columnas ───────────────────── */}
      <div className={styles.grid}>
        {/* ── Columna izquierda · Datos en vivo ───────── */}
        <div className={styles.col}>
          {/* CAN destacado */}
          {can ? (
            <Section
              title="Telemetría en vivo"
              hrefDeep={`/objeto/vehiculo/${id}?m=telemetria`}
              hint={`Equipo ${caps.deviceModel}`}
            >
              <div className={styles.kpiQuad}>
                <MiniKpi
                  label="RPM"
                  value={can.rpm}
                  unit="rpm"
                  accent={can.rpm > 2400 ? "warn" : undefined}
                />
                <MiniKpi
                  label="Combustible"
                  value={can.fuelLevelPct.toFixed(0)}
                  unit="%"
                  accent={can.fuelLevelPct < 15 ? "critical" : undefined}
                />
                <MiniKpi
                  label="Temp. motor"
                  value={can.engineTempC.toFixed(0)}
                  unit="°C"
                  accent={can.engineTempC > 100 ? "critical" : undefined}
                />
                <MiniKpi
                  label="Eco-score"
                  value={can.ecoScore}
                  unit="/100"
                  accent={can.ecoScore < 50 ? "warn" : undefined}
                />
              </div>
              {can.dtcCodes.length > 0 && (
                <div className={styles.inlineWarn}>
                  <AlertTriangle size={12} />
                  <span>
                    {can.dtcCodes.length}{" "}
                    {can.dtcCodes.length === 1 ? "código DTC activo" : "códigos DTC activos"} ·{" "}
                    {can.dtcCodes.join(" · ")}
                  </span>
                </div>
              )}
            </Section>
          ) : (
            <Section
              title="Telemetría en vivo"
              hrefDeep={`/objeto/vehiculo/${id}?m=telemetria`}
              hint={`Equipo ${caps.deviceModel}`}
            >
              <div className={styles.empty}>
                <p>
                  Equipo <strong>{caps.deviceModel}</strong> sin acceso al bus
                  CAN. Solo reporta posición GPS.
                </p>
              </div>
            </Section>
          )}

          {/* Conductor actual */}
          {currentDriver && (
            <Section
              title="Conductor"
              hrefDeep={`/objeto/vehiculo/${id}?m=conductores`}
              hint={currentDriver.isCurrent ? "Asignado actualmente" : "Más reciente"}
            >
              <Link
                href={`/objeto/conductor/${currentDriver.personId}`}
                className={styles.driverCard}
              >
                <div className={styles.driverInfo}>
                  <span className={styles.driverName}>
                    {currentDriver.firstName} {currentDriver.lastName}
                  </span>
                  <span className={styles.driverMeta}>
                    {currentDriver.dayCount} días · {currentDriver.tripCount} viajes ·{" "}
                    {currentDriver.totalKm.toLocaleString("es-AR")} km
                  </span>
                </div>
                <div className={styles.driverScore}>
                  <span className={styles.scoreNum}>{currentDriver.safetyScore}</span>
                  <span className={styles.scoreUnit}>/100</span>
                </div>
              </Link>
            </Section>
          )}
        </div>

        {/* ── Columna derecha · Histórico y alertas ───── */}
        <div className={styles.col}>
          {/* KPIs del mes */}
          <Section
            title="Últimos 30 días"
            hrefDeep={`/objeto/vehiculo/${id}?m=actividad`}
            hint="Datos agregados"
          >
            <div className={styles.kpiQuad}>
              <MiniKpi
                label="Distancia"
                value={monthSummary.distanceKm.toLocaleString("es-AR")}
                unit="km"
              />
              <MiniKpi
                label="Viajes"
                value={monthSummary.tripCount}
              />
              <MiniKpi
                label="Tiempo activo"
                value={formatHours(monthSummary.activeMin)}
              />
              <MiniKpi
                label="Eventos"
                value={monthSummary.eventCount}
                accent={monthSummary.eventCount > 20 ? "warn" : undefined}
              />
            </div>
          </Section>

          {/* Alarmas activas */}
          <Section
            title="Alarmas activas"
            hrefDeep={`/objeto/vehiculo/${id}?m=seguridad`}
            hint={
              openAlarms.length === 0
                ? "Sin alarmas"
                : `${openAlarms.length} ${openAlarms.length === 1 ? "alarma" : "alarmas"}`
            }
          >
            {openAlarms.length === 0 ? (
              <div className={styles.allClear}>
                ✓ Sin alarmas activas
              </div>
            ) : (
              <ul className={styles.alarmList}>
                {openAlarms.map((a) => (
                  <li key={a.id} className={styles.alarmItem}>
                    <span
                      className={`${styles.severityDot} ${styles[`sev_${a.severity}`]}`}
                      aria-hidden
                    />
                    <span className={styles.alarmType}>
                      {humanizeAlarmType(a.type)}
                    </span>
                    <span className={styles.alarmTime}>
                      {formatRelative(a.triggeredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {/* ── Atajos a otras tabs ───────────────────────────── */}
      <Section title="Explorar" hint="Profundizar en otra dimensión del vehículo">
        <div className={styles.shortcutGrid}>
          <Link
            href={`/objeto/vehiculo/${id}?m=telemetria`}
            className={styles.shortcut}
          >
            <span className={styles.shortcutLabel}>Telemetría</span>
            <span className={styles.shortcutHint}>RPM, combustible, DTCs</span>
          </Link>
          <Link
            href={`/objeto/vehiculo/${id}?m=conductores`}
            className={styles.shortcut}
          >
            <span className={styles.shortcutLabel}>Conductores</span>
            <span className={styles.shortcutHint}>Historial completo</span>
          </Link>
          <Link
            href={`/objeto/vehiculo/${id}?m=actividad`}
            className={styles.shortcut}
          >
            <span className={styles.shortcutLabel}>Actividad</span>
            <span className={styles.shortcutHint}>Período, viajes, KPIs</span>
          </Link>
          <Link
            href={`/objeto/vehiculo/${id}?m=seguridad`}
            className={styles.shortcut}
          >
            <span className={styles.shortcutLabel}>Seguridad</span>
            <span className={styles.shortcutHint}>Alarmas y eventos</span>
          </Link>
          <Link
            href={`/seguimiento/historial?assetId=${id}`}
            className={styles.shortcut}
          >
            <span className={styles.shortcutLabel}>Historial</span>
            <span className={styles.shortcutHint}>Recorrido del día</span>
          </Link>
        </div>
      </Section>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────

function HeroState({
  data,
}: {
  data: import("@/lib/queries/asset-live-status").AssetLiveStatusData;
}) {
  const { lastPosition, commState, msSinceLastSeen, openAlarms } = data;

  if (!lastPosition) {
    return (
      <div className={styles.hero}>
        <h2 className={styles.heroTitle}>Sin datos recientes</h2>
        <p className={styles.heroSubtitle}>
          Este vehículo aún no reportó posición.
        </p>
      </div>
    );
  }

  const speed = Math.round(lastPosition.speedKmh);
  let stateLabel: string;
  let stateClass = styles.heroNeutral;
  if (commState === "NO_COMM") {
    stateLabel = `Sin comunicación · última hace ${formatRelativeMs(msSinceLastSeen)}`;
    stateClass = styles.heroWarn;
  } else if (lastPosition.ignition && speed >= 5) {
    stateLabel = `En movimiento · ${speed} km/h`;
    stateClass = styles.heroActive;
  } else if (lastPosition.ignition) {
    stateLabel = "Detenido con motor encendido";
    stateClass = styles.heroIdle;
  } else {
    stateLabel = "Apagado";
    stateClass = styles.heroOff;
  }

  return (
    <div className={`${styles.hero} ${stateClass}`}>
      <div className={styles.heroLeft}>
        <h2 className={styles.heroTitle}>{stateLabel}</h2>
        <p className={styles.heroSubtitle}>
          <MapPin size={11} className={styles.heroIcon} />
          {lastPosition.lat.toFixed(4)}, {lastPosition.lng.toFixed(4)} ·{" "}
          {formatRelativeMs(msSinceLastSeen)} atrás
        </p>
      </div>
      {openAlarms > 0 && (
        <div className={styles.heroAlarmBadge}>
          <AlertTriangle size={13} />
          <span>
            {openAlarms} {openAlarms === 1 ? "alarma" : "alarmas"}
          </span>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  hrefDeep,
  hint,
  children,
}: {
  title: string;
  hrefDeep?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {hint && <span className={styles.sectionHint}>{hint}</span>}
        {hrefDeep && (
          <Link href={hrefDeep} className={styles.sectionDeep}>
            Ver más <ChevronRight size={12} />
          </Link>
        )}
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function MiniKpi({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: "warn" | "critical" | "good";
}) {
  const accentClass = accent ? styles[`mini_${accent}`] : "";
  return (
    <div className={`${styles.miniKpi} ${accentClass}`}>
      <span className={styles.miniLabel}>{label}</span>
      <div className={styles.miniRow}>
        <span className={styles.miniValue}>{value}</span>
        {unit && <span className={styles.miniUnit}>{unit}</span>}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

interface MonthSummary {
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
}

const TELEMETRY_EVENT_TYPES = [
  "HARSH_ACCELERATION",
  "HARSH_BRAKING",
  "HARSH_CORNERING",
  "SPEEDING",
  "OVERSPEED",
  "IDLE",
] as const;

async function getAssetMonthSummary(assetId: string): Promise<MonthSummary> {
  const now = new Date();
  const fromDt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [days, eventCount] = await Promise.all([
    db.assetDriverDay.findMany({
      where: { assetId, day: { gte: fromDt } },
      select: { distanceKm: true, activeMin: true, tripCount: true },
    }),
    db.event.count({
      where: {
        assetId,
        occurredAt: { gte: fromDt },
        type: { in: TELEMETRY_EVENT_TYPES },
      },
    }),
  ]);

  return {
    distanceKm: Math.round(
      days.reduce((acc, d) => acc + d.distanceKm, 0) * 10,
    ) / 10,
    activeMin: days.reduce((acc, d) => acc + d.activeMin, 0),
    tripCount: days.reduce((acc, d) => acc + d.tripCount, 0),
    eventCount,
  };
}

function formatHours(activeMin: number): string {
  const h = Math.floor(activeMin / 60);
  const m = activeMin % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatRelative(d: Date): string {
  return formatRelativeMs(Date.now() - d.getTime());
}

function formatRelativeMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const dd = Math.floor(h / 24);
  return `hace ${dd}d`;
}

function humanizeAlarmType(type: string): string {
  const map: Record<string, string> = {
    SOS: "Botón pánico",
    OVERSPEED: "Exceso de velocidad",
    GEOFENCE_ENTER: "Entrada a geocerca",
    GEOFENCE_EXIT: "Salida de geocerca",
    LOW_BATTERY: "Batería baja",
    POWER_LOSS: "Pérdida de alimentación",
    HARSH_BRAKING: "Frenado brusco",
    HARSH_ACCELERATION: "Aceleración brusca",
    JAMMING: "Jamming detectado",
    DTC_TRIGGER: "Código de falla",
    NO_COMMUNICATION: "Sin comunicación",
    OFF_HOURS: "Fuera de horario",
  };
  return map[type] ?? type;
}
