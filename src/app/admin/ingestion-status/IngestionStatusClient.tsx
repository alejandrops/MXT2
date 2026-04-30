"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Radio,
  Route,
} from "lucide-react";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  IngestionStatusClient
//  ─────────────────────────────────────────────────────────────
//  Renderiza el snapshot de /api/ingest/flespi/metrics. Hace fetch
//  inicial y luego refresh cada 30s (configurable con toggle).
//
//  El response tiene este shape (definido en
//  src/lib/ingestion/metrics.ts y src/app/api/ingest/flespi/metrics):
//
//    {
//      startedAt, uptimeSeconds,
//      totals: { received, ok, skipped, duplicates, errors,
//                tripsCreated, tripsDiscarded },
//      skipsByReason: { [reason]: count },
//      lastMessageAt, batchesProcessed, avgBatchSize,
//      devices: { totalInstalled, neverReported,
//                 silentMoreThan5min, silentMoreThan1hour,
//                 silentMoreThan24hours }
//    }
// ═══════════════════════════════════════════════════════════════

interface MetricsSnapshot {
  startedAt: string;
  uptimeSeconds: number;
  totals: {
    received: number;
    ok: number;
    skipped: number;
    duplicates: number;
    errors: number;
    tripsCreated: number;
    tripsDiscarded: number;
  };
  skipsByReason: Record<string, number>;
  lastMessageAt: string | null;
  batchesProcessed: number;
  avgBatchSize: number;
  devices: {
    totalInstalled: number;
    neverReported: number;
    silentMoreThan5min: number;
    silentMoreThan1hour: number;
    silentMoreThan24hours: number;
  };
}

const REFRESH_INTERVAL_MS = 30_000;

const SKIP_REASON_LABEL: Record<string, string> = {
  unknown_imei: "IMEI desconocido",
  device_unassigned: "Device sin asset asignado",
  missing_position: "Sin posición",
  missing_timestamp: "Sin timestamp",
  missing_ident: "Sin identificador",
  invalid_fix: "Fix GPS inválido",
};

export function IngestionStatusClient() {
  const [data, setData] = useState<MetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/ingest/flespi/metrics", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as MetricsSnapshot;
      setData(json);
      setError(null);
      setLastFetchAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchMetrics, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, fetchMetrics]);

  if (loading && !data) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando métricas...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <AlertTriangle size={20} />
          <div>
            <strong>Error al cargar métricas</strong>
            <p>{error}</p>
            <button onClick={fetchMetrics} className={styles.retryBtn}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const okPct =
    data.totals.received > 0
      ? Math.round((data.totals.ok / data.totals.received) * 100)
      : 0;
  const skipPct =
    data.totals.received > 0
      ? Math.round((data.totals.skipped / data.totals.received) * 100)
      : 0;
  const errPct =
    data.totals.received > 0
      ? Math.round((data.totals.errors / data.totals.received) * 100)
      : 0;

  const lastMessageAgo = data.lastMessageAt
    ? humanAgo(new Date(data.lastMessageAt))
    : "nunca";
  const uptimeText = humanDuration(data.uptimeSeconds);

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Estado de ingestion</h1>
          <p className={styles.subtitle}>
            Endpoint <code>/api/ingest/flespi</code> · uptime {uptimeText} ·
            último mensaje {lastMessageAgo}
          </p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh 30s</span>
          </label>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={fetchMetrics}
            title={
              lastFetchAt
                ? `Última actualización: ${lastFetchAt.toLocaleTimeString("es-AR")}`
                : "Refrescar"
            }
          >
            <RefreshCw size={14} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* ── KPI strip · totales globales ────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile
          icon={<Activity size={18} />}
          label="Recibidos"
          value={formatNumber(data.totals.received)}
          caption={`${formatNumber(data.batchesProcessed)} batches · promedio ${data.avgBatchSize}`}
        />
        <KpiTile
          icon={<CheckCircle2 size={18} />}
          label="OK"
          value={formatNumber(data.totals.ok)}
          caption={`${okPct}% del total`}
          accent={okPct >= 90 ? "ok" : okPct >= 70 ? "warn" : "bad"}
        />
        <KpiTile
          icon={<XCircle size={18} />}
          label="Skipped"
          value={formatNumber(data.totals.skipped)}
          caption={`${skipPct}% del total`}
          accent={skipPct < 5 ? "ok" : skipPct < 20 ? "warn" : "bad"}
        />
        <KpiTile
          icon={<AlertTriangle size={18} />}
          label="Errores"
          value={formatNumber(data.totals.errors)}
          caption={`${errPct}% del total`}
          accent={errPct === 0 ? "ok" : errPct < 1 ? "warn" : "bad"}
        />
        <KpiTile
          icon={<Clock size={18} />}
          label="Duplicados"
          value={formatNumber(data.totals.duplicates)}
          caption="Rechazados por unique"
        />
      </div>

      <div className={styles.row2col}>
        {/* ── Detección de viajes ───────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Route size={16} />
            <span>Detección de viajes</span>
          </h2>
          <div className={styles.cardBody}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Trips creados</span>
              <span className={styles.statValue}>
                {formatNumber(data.totals.tripsCreated)}
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>
                Trips descartados
                <span className={styles.statHint}>
                  por filtros mínimos
                </span>
              </span>
              <span className={styles.statValue}>
                {formatNumber(data.totals.tripsDiscarded)}
              </span>
            </div>
          </div>
        </section>

        {/* ── Skip reasons ──────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <XCircle size={16} />
            <span>Razones de descarte</span>
          </h2>
          <div className={styles.cardBody}>
            {Object.keys(data.skipsByReason).length === 0 ? (
              <p className={styles.empty}>
                Ningún message descartado todavía.
              </p>
            ) : (
              Object.entries(data.skipsByReason)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => (
                  <div key={reason} className={styles.statRow}>
                    <span className={styles.statLabel}>
                      {SKIP_REASON_LABEL[reason] ?? reason}
                    </span>
                    <span className={styles.statValue}>
                      {formatNumber(count)}
                    </span>
                  </div>
                ))
            )}
          </div>
        </section>
      </div>

      {/* ── Devices silenciosos ──────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Radio size={16} />
          <span>Devices silenciosos</span>
          <span className={styles.cardSubtitle}>
            Sobre {formatNumber(data.devices.totalInstalled)} INSTALLED con
            asset asignado
          </span>
        </h2>
        <div className={styles.silentGrid}>
          <SilentTile
            label="Nunca reportaron"
            value={data.devices.neverReported}
            total={data.devices.totalInstalled}
          />
          <SilentTile
            label=">5 min sin reportar"
            value={data.devices.silentMoreThan5min}
            total={data.devices.totalInstalled}
          />
          <SilentTile
            label=">1 h sin reportar"
            value={data.devices.silentMoreThan1hour}
            total={data.devices.totalInstalled}
          />
          <SilentTile
            label=">24 h sin reportar"
            value={data.devices.silentMoreThan24hours}
            total={data.devices.totalInstalled}
          />
        </div>
      </section>

      {/* ── Footer · process info ────────────────────────────── */}
      <p className={styles.footer}>
        Proceso iniciado{" "}
        {new Date(data.startedAt).toLocaleString("es-AR")}
        {error && (
          <>
            {" · "}
            <span className={styles.errorInline}>
              Error en último fetch: {error}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function KpiTile({
  icon,
  label,
  value,
  caption,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption?: string;
  accent?: "ok" | "warn" | "bad";
}) {
  const accentClass = accent ? styles[`accent_${accent}`] : "";
  return (
    <div className={`${styles.kpiTile} ${accentClass}`}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiIcon}>{icon}</span>
        <span className={styles.kpiLabel}>{label}</span>
      </div>
      <div className={styles.kpiValue}>{value}</div>
      {caption && <div className={styles.kpiCaption}>{caption}</div>}
    </div>
  );
}

function SilentTile({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  // Color escala · más silenciosos = más rojo
  const accent =
    value === 0 ? "ok" : pct < 5 ? "warn" : pct < 20 ? "warn" : "bad";
  return (
    <div className={`${styles.silentTile} ${styles[`accent_${accent}`]}`}>
      <div className={styles.silentValue}>{formatNumber(value)}</div>
      <div className={styles.silentLabel}>{label}</div>
      {total > 0 && (
        <div className={styles.silentPct}>{pct}% del total</div>
      )}
    </div>
  );
}

// ─── Format helpers ──────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString("es-AR");
}

function humanAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} días`;
}

function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
