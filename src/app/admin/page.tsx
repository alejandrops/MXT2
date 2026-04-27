import Link from "next/link";
import { ArrowRight, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { db } from "@/lib/db";
import { getDeviceCounts } from "@/lib/queries";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin · Backoffice dashboard
//  ─────────────────────────────────────────────────────────────
//  Cross-tenant operational view for Maxtracker staff. Mirrors v8
//  s-bo-home (line 23585+):
//    · Top strip: comm health KPIs across the entire fleet
//    · "Alertas técnicas" panel: actionable items by severity
//    · Quick links to Dispositivos / SIMs / Instalaciones
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface AdminAlert {
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
  href: string;
}

export default async function AdminHomePage() {
  const [deviceCounts, accountCount] = await Promise.all([
    getDeviceCounts(),
    db.account.count(),
  ]);

  // Build technical alerts from real signals
  const alerts: AdminAlert[] = [];
  if (deviceCounts.offline > 0) {
    alerts.push({
      severity: "critical",
      title: `${deviceCounts.offline} dispositivos offline`,
      detail: "Sin reportar hace más de 7 días",
      href: "/admin/dispositivos?state=OFFLINE",
    });
  }
  if (deviceCounts.long > 0) {
    alerts.push({
      severity: "warn",
      title: `${deviceCounts.long} sin reportar (>24h)`,
      detail: "Requieren revisión técnica",
      href: "/admin/dispositivos?state=LONG",
    });
  }
  if (deviceCounts.stale > 0) {
    alerts.push({
      severity: "warn",
      title: `${deviceCounts.stale} con conexión reciente lenta`,
      detail: "Última señal entre 30 min y 24 h",
      href: "/admin/dispositivos?state=STALE",
    });
  }

  return (
    <div className={styles.page}>
      {/* ── KPI strip · cross-fleet health ─────────────────── */}
      <div className={styles.statsBar}>
        <Stat
          value={deviceCounts.online + deviceCounts.recent}
          label="online"
          color="grn"
        />
        <Stat
          value={deviceCounts.offline}
          label="offline >7d"
          color="red"
        />
        <Stat
          value={deviceCounts.long}
          label="sin reportar >24h"
          color="amb"
        />
        <Stat
          value={deviceCounts.stale}
          label="reciente >30m"
          color="amb"
        />
        <Stat
          value={accountCount}
          label="clientes activos"
          color="neutral"
        />
        <Stat
          value={deviceCounts.total}
          label="dispositivos totales"
          color="neutral"
        />
      </div>

      {/* ── Two columns ─────────────────────────────────────── */}
      <div className={styles.grid}>
        {/* Alertas técnicas */}
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <span className={styles.cardTitle}>Alertas técnicas</span>
            {alerts.length > 0 ? (
              <span className={styles.cardSubLive}>{alerts.length} activas</span>
            ) : (
              <span className={styles.cardSub}>todo en orden</span>
            )}
          </header>

          <div className={styles.alertsList}>
            {alerts.length === 0 ? (
              <div className={styles.emptyAlerts}>
                Sin alertas técnicas en este momento.
              </div>
            ) : (
              alerts.map((alert, i) => (
                <AlertRow key={i} alert={alert} />
              ))
            )}
          </div>
        </section>

        {/* Acciones rápidas */}
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <span className={styles.cardTitle}>Accesos rápidos</span>
          </header>

          <div className={styles.quickList}>
            <QuickLink
              href="/admin/dispositivos"
              label="Dispositivos"
              detail={`${deviceCounts.total} en flota · ${deviceCounts.primary} primarios`}
            />
            <QuickLink
              href="/admin/clientes"
              label="Clientes"
              detail={`${accountCount} cuentas activas`}
            />
            <QuickLink
              href="/admin/sims"
              label="Líneas SIM"
              detail="Gestión de planes y vencimientos"
            />
            <QuickLink
              href="/admin/instalaciones"
              label="Instalaciones"
              detail="Self-install y onboarding"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function Stat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "grn" | "red" | "amb" | "neutral";
}) {
  return (
    <div className={styles.stat}>
      <span className={`${styles.statValue} ${styles[`statValue_${color}`]}`}>
        {value.toLocaleString("es-AR")}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function AlertRow({ alert }: { alert: AdminAlert }) {
  const Icon =
    alert.severity === "critical"
      ? AlertCircle
      : alert.severity === "warn"
        ? AlertTriangle
        : Info;
  return (
    <Link href={alert.href} className={`${styles.alert} ${styles[`alert_${alert.severity}`]}`}>
      <Icon size={14} className={styles.alertIcon} />
      <div className={styles.alertBody}>
        <span className={styles.alertTitle}>{alert.title}</span>
        <span className={styles.alertDetail}>{alert.detail}</span>
      </div>
      <ArrowRight size={13} className={styles.alertArrow} />
    </Link>
  );
}

function QuickLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link href={href} className={styles.quickLink}>
      <div className={styles.quickBody}>
        <span className={styles.quickLabel}>{label}</span>
        <span className={styles.quickDetail}>{detail}</span>
      </div>
      <ArrowRight size={13} className={styles.quickArrow} />
    </Link>
  );
}
