import type { BoletinData } from "@/app/(product)/direccion/boletin/[period]/page";
import { KpiCard } from "@/components/maxtracker/ui";
import Link from "next/link";
import styles from "./Block.module.css";

// ═══════════════════════════════════════════════════════════════
//  Bloque F · Seguridad · alarmas
//  ─────────────────────────────────────────────────────────────
//  KPIs principales del módulo Seguridad para el período más
//  breakdowns por severity, dominio y top vehículos.
//
//  Alarmas vs Eventos · diferencia clave que hay que dejar clara
//  en el boletín: alarmas son rules accionables (tienen lifecycle ·
//  alguien las atiende), eventos son detecciones primarias.
//  Bloque F · alarmas · qué disparó el operador.
//  Bloque G · eventos · qué pasó en la operación.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: BoletinData;
}

export function BlockF_Seguridad({ data }: Props) {
  const { alarms, current, previous } = data;

  const deltaAlarms = computeDelta(current.alarmCount, previous.alarmCount);
  const deltaLabel = "vs mes anterior";

  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockLetter}>F</span>
        <div className={styles.blockTitleWrap}>
          <h2 className={styles.blockTitle}>Seguridad · alarmas</h2>
          <p className={styles.blockHint}>
            Lifecycle de las alarmas accionables del período · breakdown por
            severity y dominio · top vehículos con más incidentes.
          </p>
        </div>
      </header>

      {/* KPIs · 4 cards */}
      <div className={styles.kpiGrid}>
        <KpiCard
          size="md"
          label="Total del período"
          value={alarms.total.toLocaleString("es-AR")}
          delta={deltaAlarms}
          deltaLabel={deltaLabel}
          isReverseDelta
        />
        <KpiCard
          size="md"
          label="Activas al cierre"
          value={alarms.activeAtClose.toLocaleString("es-AR")}
        />
        <KpiCard
          size="md"
          label="Severity máx"
          value={
            alarms.maxSeverity ? severityLabel(alarms.maxSeverity) : "—"
          }
        />
        <KpiCard
          size="md"
          label="MTTR"
          value={alarms.mttrMin > 0 ? fmtDuration(alarms.mttrMin) : "—"}
        />
      </div>

      {alarms.total === 0 ? (
        <p className={styles.empty}>
          No se dispararon alarmas en el período.
        </p>
      ) : (
        <div className={styles.fGrid}>
          {/* Breakdown por severity */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Por severity</h3>
            <BreakdownBars
              items={alarms.bySeverity.map((s) => ({
                label: severityLabel(s.severity),
                value: s.count,
                cls:
                  s.severity === "CRITICAL"
                    ? styles.sevCritical!
                    : s.severity === "HIGH"
                      ? styles.sevHigh!
                      : s.severity === "MEDIUM"
                        ? styles.sevMedium!
                        : styles.sevLow!,
              }))}
              total={alarms.total}
            />
          </div>

          {/* Breakdown por dominio */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Por dominio</h3>
            <BreakdownBars
              items={alarms.byDomain.map((d) => ({
                label: domainLabel(d.domain),
                value: d.count,
                cls:
                  d.domain === "SEGURIDAD"
                    ? styles.domSec!
                    : styles.domCond!,
              }))}
              total={alarms.total}
            />
          </div>
        </div>
      )}

      {/* Top vehículos con más alarmas */}
      {alarms.topVehicles.length > 0 && (
        <div className={styles.subsection}>
          <h3 className={styles.subsectionTitle}>
            Top vehículos con más alarmas
          </h3>
          <ol className={styles.rankList}>
            {alarms.topVehicles.map((v, i) => (
              <li key={v.assetId} className={styles.rankRow}>
                <span className={styles.rankNum}>{i + 1}</span>
                <span className={styles.rankPrimary}>
                  <Link
                    href={`/objeto/vehiculo/${v.assetId}?m=seguridad`}
                    className={styles.rankLink}
                  >
                    {v.assetName}
                  </Link>
                  {v.plate && (
                    <span className={styles.rankPlate}>{v.plate}</span>
                  )}
                </span>
                <span className={styles.rankValue}>
                  <span className={styles.rankBad}>
                    {v.count.toLocaleString("es-AR")}
                  </span>
                  <span className={styles.rankUnit}>alarmas</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BreakdownBars · barras horizontales con label/value/pct
// ═══════════════════════════════════════════════════════════════

function BreakdownBars({
  items,
  total,
}: {
  items: { label: string; value: number; cls: string }[];
  total: number;
}) {
  const max = Math.max(0.001, ...items.map((i) => i.value));
  return (
    <div className={styles.bdGrid}>
      {items.map((item) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        const barPct = (item.value / max) * 100;
        return (
          <div key={item.label} className={styles.bdRow}>
            <span className={styles.bdLabel}>{item.label}</span>
            <div className={styles.bdTrack}>
              <div
                className={`${styles.bdFill} ${item.cls}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <span className={styles.bdValue}>
              {item.value.toLocaleString("es-AR")}
              <span className={styles.bdPct}>· {pct.toFixed(0)}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function computeDelta(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return (current - prev) / prev;
}

function severityLabel(s: string): string {
  const map: Record<string, string> = {
    CRITICAL: "Crítica",
    HIGH: "Alta",
    MEDIUM: "Media",
    LOW: "Baja",
  };
  return map[s] ?? s;
}

function domainLabel(d: string): string {
  if (d === "SEGURIDAD") return "Seguridad";
  if (d === "CONDUCCION") return "Conducción";
  return d;
}

function fmtDuration(min: number): string {
  if (min < 1) return "<1m";
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d}d` : `${d}d${remH}h`;
}
