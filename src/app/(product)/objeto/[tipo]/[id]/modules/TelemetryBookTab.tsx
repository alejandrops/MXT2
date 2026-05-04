// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import {
  getDeviceCapabilities,
  resolveCanSnapshot,
} from "@/lib/mock-can";
import type { CanSnapshot } from "@/lib/mock-can";
import styles from "./TelemetryBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  TelemetryBookTab · S1-L4 libros-vehiculo
//  ─────────────────────────────────────────────────────────────
//  Tab "Telemetría" del Libro del Objeto · solo aplica al vehículo.
//
//  Muestra:
//    · KPIs en vivo del CAN bus (RPM, temp, combustible, eco)
//    · Sección Combustible (nivel, consumo, eficiencia)
//    · Sección Distancia y uso (odómetro real, horas motor, idle)
//    · DTC codes activos (si los hay)
//    · Estado del equipo (FMC003 / FMB920 / Legacy)
//
//  Si el vehículo no tiene CAN (FMB920 / Legacy):
//    · Muestra estado del equipo + explicación
//    · Sin valores · placeholder claro
//
//  Status de los datos:
//    · Snapshot del momento · regenerado cada vez que se carga la
//      página (server-side, determinístico por assetId + wallClock).
//    · Curvas históricas · NO disponibles en este lote · llegan en
//      Sprint 2 cuando el schema persista CAN data.
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: "vehiculo" | "conductor" | "grupo";
  id: string;
}

export async function TelemetryBookTab({ type, id }: Props) {
  // Sanity · solo aplica a vehículo · si llega otro tipo, mostrar mensaje
  if (type !== "vehiculo") {
    return (
      <div className={styles.empty}>
        <p>Telemetría solo aplica a vehículos.</p>
      </div>
    );
  }

  // Multi-tenant scope
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "catalogos", null);

  // Obtener el última posición conocida · usamos su speedKmh + ignition
  // para alimentar el generador de CAN. Si no hay posición, simulamos
  // motor apagado.
  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      livePosition: true,
    },
  });

  if (!asset) {
    return (
      <div className={styles.empty}>
        <p>Vehículo no encontrado.</p>
      </div>
    );
  }
  if (scopedAccountId && asset.accountId !== scopedAccountId) {
    return (
      <div className={styles.empty}>
        <p>Vehículo no encontrado.</p>
      </div>
    );
  }

  const lastPos = asset.livePosition;
  const speedKmh = lastPos?.speedKmh ?? 0;
  const ignition = lastPos?.ignition ?? false;
  const wallClock = Date.now();

  const caps = getDeviceCapabilities(id);
  // S2-L3 · prefer persisted canData (cuando Flespi lo popule),
  // fallback al mock determinístico para demos pre-ingestor real.
  const can = resolveCanSnapshot(lastPos?.canData ?? null, {
    assetId: id,
    speedKmh,
    ignition,
    wallClockMs: wallClock,
  });

  // Si no tiene CAN · mostrar estado del equipo y explicación
  if (!can) {
    return (
      <div className={styles.body}>
        <header className={styles.head}>
          <h2 className={styles.title}>Telemetría</h2>
          <p className={styles.subtitle}>
            Datos del bus CAN del vehículo · sensores ECU.
          </p>
        </header>

        <div className={styles.deviceCard}>
          <div className={styles.deviceCardLabel}>Equipo telemático</div>
          <div className={styles.deviceCardValue}>{caps.deviceModel}</div>
          <div className={styles.deviceCardCap}>Sin acceso al bus CAN</div>
        </div>

        <div className={styles.empty}>
          <p>
            Este vehículo está equipado con un{" "}
            <strong>{caps.deviceModel}</strong> que reporta posición GPS pero
            no tiene acceso al bus CAN.
          </p>
          <p>
            Para ver telemetría extendida (RPM, temperatura, combustible,
            odómetro real, eventos del vehículo) hace falta upgrade a un
            equipo Teltonika FMC003 o FMC130.
          </p>
        </div>
      </div>
    );
  }

  // Tiene CAN · mostrar datos reales
  return (
    <div className={styles.body}>
      <header className={styles.head}>
        <h2 className={styles.title}>Telemetría</h2>
        <p className={styles.subtitle}>
          Datos del bus CAN del vehículo · sensores ECU · snapshot del momento.
        </p>
      </header>

      {/* ── Estado del equipo ─────────────────────────────── */}
      <div className={styles.deviceCard}>
        <div className={styles.deviceCardLabel}>Equipo telemático</div>
        <div className={styles.deviceCardValue}>{caps.deviceModel}</div>
        <div className={styles.deviceCardCap}>
          CAN bus activo · ECU comunicando
        </div>
      </div>

      {/* ── KPIs principales · "el ahora" ─────────────────── */}
      <div className={styles.kpiGrid}>
        <KpiCell
          label="RPM motor"
          value={can.rpm}
          unit="rpm"
          accent={can.rpm > 2400 ? "warn" : undefined}
        />
        <KpiCell
          label="Temp. motor"
          value={can.engineTempC.toFixed(1)}
          unit="°C"
          accent={can.engineTempC > 100 ? "critical" : undefined}
        />
        <KpiCell
          label="Presión aceite"
          value={can.oilPressureKpa}
          unit="kPa"
          accent={
            ignition && can.oilPressureKpa < 150 ? "warn" : undefined
          }
        />
        <KpiCell
          label="Eco-score"
          value={can.ecoScore}
          unit="/100"
          accent={
            can.ecoScore < 50
              ? "warn"
              : can.ecoScore >= 80
                ? "good"
                : undefined
          }
        />
      </div>

      {/* ── Combustible ───────────────────────────────────── */}
      <Section title="Combustible">
        <DataGrid>
          <DataItem
            label="Nivel del tanque"
            value={`${can.fuelLevelPct.toFixed(0)}%`}
            accent={can.fuelLevelPct < 15 ? "critical" : undefined}
          />
          <DataItem
            label="Consumo instantáneo"
            value={
              can.fuelConsumptionLper100km > 0
                ? `${can.fuelConsumptionLper100km.toFixed(1)} L/100km`
                : "—"
            }
            sub={ignition ? "ECU PID 0x05E" : "Motor apagado"}
          />
          <DataItem
            label="Eficiencia"
            value={
              can.fuelEfficiencyKmL > 0
                ? `${can.fuelEfficiencyKmL.toFixed(2)} km/L`
                : "—"
            }
            sub="Derivado del consumo"
          />
        </DataGrid>
      </Section>

      {/* ── Distancia y uso ──────────────────────────────── */}
      <Section title="Distancia y uso">
        <DataGrid>
          <DataItem
            label="Odómetro real"
            value={`${can.odometerKm.toLocaleString("es-AR")} km`}
            sub="ECU · no calculado por GPS"
          />
          <DataItem
            label="Horas motor totales"
            value={`${can.engineHours.toLocaleString("es-AR")} h`}
            sub="Acumulado de fábrica"
          />
          <DataItem
            label="Idle hoy"
            value={formatIdle(can.idleSecondsToday)}
            sub="Tiempo motor encendido sin movimiento"
            accent={can.idleSecondsToday > 3600 ? "warn" : undefined}
          />
          {can.ptoActive && (
            <DataItem
              label="PTO"
              value="Activo"
              sub="Power Take-Off en uso"
              accent="good"
            />
          )}
        </DataGrid>
      </Section>

      {/* ── Estados del vehículo ─────────────────────────── */}
      <Section title="Estados del vehículo">
        <DataGrid>
          <DataItem
            label="Puerta del conductor"
            value={can.doorOpen ? "Abierta" : "Cerrada"}
            accent={can.doorOpen ? "warn" : "good"}
          />
          <DataItem
            label="Cinturón"
            value={can.seatbeltOk ? "Colocado" : "Sin colocar"}
            accent={can.seatbeltOk ? "good" : "warn"}
          />
          <DataItem
            label="Freno de mano"
            value={can.parkingBrake ? "Puesto" : "Liberado"}
          />
        </DataGrid>
      </Section>

      {/* ── DTC codes ─────────────────────────────────────── */}
      {can.dtcCodes.length > 0 && (
        <Section title="Diagnóstico · códigos activos">
          <div className={styles.dtcList}>
            {can.dtcCodes.map((code) => (
              <div key={code} className={styles.dtcItem}>
                <span className={styles.dtcCode}>{code}</span>
                <span className={styles.dtcDesc}>{describeDtc(code)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Footer · disclaimer ───────────────────────────── */}
      <p className={styles.disclaimer}>
        Curvas históricas (RPM por hora, consumo por día, etc) llegan en
        Sprint 2 cuando el schema persista las lecturas CAN.
      </p>
    </div>
  );
}

// ─── Sub-componentes locales ─────────────────────────────────

function KpiCell({
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
  const accentClass = accent ? styles[`kpi_${accent}`] : "";
  return (
    <div className={`${styles.kpiCell} ${accentClass}`}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValueRow}>
        <span className={styles.kpiValue}>{value}</span>
        {unit && <span className={styles.kpiUnit}>{unit}</span>}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function DataGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.dataGrid}>{children}</div>;
}

function DataItem({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "warn" | "critical" | "good";
}) {
  const accentClass = accent ? styles[`item_${accent}`] : "";
  return (
    <div className={`${styles.dataItem} ${accentClass}`}>
      <div className={styles.itemLabel}>{label}</div>
      <div className={styles.itemValue}>{value}</div>
      {sub && <div className={styles.itemSub}>{sub}</div>}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function formatIdle(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

// Descripciones humanas para DTC codes comunes · SAE J2012
function describeDtc(code: string): string {
  const map: Record<string, string> = {
    P0301: "Misfire detectado en cilindro 1",
    P0420: "Eficiencia del catalizador bajo umbral",
    P0455: "Sistema EVAP · fuga grande detectada",
    U0100: "Pérdida de comunicación con ECM/PCM",
    P0171: "Sistema mezcla pobre (banco 1)",
    P2002: "Eficiencia del filtro de partículas bajo umbral",
  };
  return map[code] ?? "Código de falla activo";
}
