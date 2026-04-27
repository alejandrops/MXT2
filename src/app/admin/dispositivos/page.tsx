import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getDeviceCounts,
  listDevices,
  type DeviceCommState,
} from "@/lib/queries";
import { KpiTile } from "@/components/maxtracker";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /gestion/dispositivos · Lote C · global devices listing
//  ─────────────────────────────────────────────────────────────
//  Cross-fleet tracker inventory with comm state at a glance.
//  Used by ops and IT to spot devices that have stopped reporting,
//  by vendor/model fragmentation, or to find a vehicle by IMEI.
//
//  KPIs:    total · online · stale · offline · primarios
//  Filtros: búsqueda (IMEI, vendor, modelo) · estado · solo primarios
//  Tabla:   IMEI · Vendor/Modelo · Vehículo · Última conexión · Rol
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    state?: string;
    primary?: string;
  }>;
}

const ALLOWED_STATES: DeviceCommState[] = [
  "ONLINE",
  "RECENT",
  "STALE",
  "LONG",
  "OFFLINE",
];

export default async function DispositivosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search =
    typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;
  const state =
    typeof sp.state === "string" &&
    ALLOWED_STATES.includes(sp.state as DeviceCommState)
      ? (sp.state as DeviceCommState)
      : null;
  const primaryOnly = sp.primary === "1";

  const [counts, listing] = await Promise.all([
    getDeviceCounts(),
    listDevices({ search, commState: state, primaryOnly }),
  ]);

  return (
    <div className={styles.page}>
      {/* ── KPI strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Dispositivos" value={counts.total} />
        <KpiTile
          label="Online"
          value={counts.online}
          accent={counts.online > 0 ? "grn" : undefined}
        />
        <KpiTile label="Reciente" value={counts.recent} />
        <KpiTile
          label="Sin reportar (>24h)"
          value={counts.stale + counts.long}
          accent={counts.stale + counts.long > 0 ? "amb" : undefined}
        />
        <KpiTile
          label="Offline (>7d)"
          value={counts.offline}
          accent={counts.offline > 0 ? "red" : undefined}
        />
        <KpiTile label="Primarios" value={counts.primary} />
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <form className={styles.filterBar} action="/gestion/dispositivos">
        <input
          name="q"
          type="search"
          defaultValue={search ?? ""}
          placeholder="Buscar por IMEI, vendor o modelo…"
          className={styles.searchInput}
        />
        <select
          name="state"
          defaultValue={state ?? ""}
          className={styles.select}
        >
          <option value="">Todos los estados</option>
          <option value="ONLINE">Online</option>
          <option value="RECENT">Reciente</option>
          <option value="STALE">Sin reportar (24h)</option>
          <option value="LONG">Sin reportar (7d)</option>
          <option value="OFFLINE">Offline</option>
        </select>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="primary"
            value="1"
            defaultChecked={primaryOnly}
          />
          Solo primarios
        </label>
        <button type="submit" className={styles.applyBtn}>
          Aplicar
        </button>
        {(search || state || primaryOnly) && (
          <Link
            href="/gestion/dispositivos"
            className={styles.clearLink}
          >
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Table ──────────────────────────────────────────── */}
      {listing.rows.length === 0 ? (
        <div className={styles.empty}>
          {search || state || primaryOnly
            ? "No hay dispositivos que coincidan con los filtros."
            : "No hay dispositivos cargados."}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>IMEI</th>
                <th className={styles.th}>Vendor / Modelo</th>
                <th className={styles.th}>Vehículo</th>
                <th className={styles.th}>Estado</th>
                <th className={styles.th}>Última conexión</th>
                <th className={styles.th}>Rol</th>
                <th className={styles.thAction} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {listing.rows.map((d) => {
                const href = `/gestion/vehiculos/${d.asset.id}?tab=devices`;
                return (
                  <tr key={d.id} className={styles.row}>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        <span className={styles.mono}>{d.imei}</span>
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        <span className={styles.vendor}>{d.vendor}</span>
                        <span className={styles.model}>{d.model}</span>
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        <div className={styles.assetCell}>
                          <span className={styles.assetName}>
                            {d.asset.name}
                          </span>
                          {d.asset.plate && (
                            <span className={styles.assetPlate}>
                              {d.asset.plate}
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        <CommBadge state={d.commState} />
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        {d.lastSeenAt ? (
                          <span className={styles.dim}>
                            {formatRelative(d.lastSeenAt)}
                          </span>
                        ) : (
                          <span className={styles.placeholder}>nunca</span>
                        )}
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        {d.isPrimary ? (
                          <span className={styles.primaryPill}>Primario</span>
                        ) : (
                          <span className={styles.dim}>Secundario</span>
                        )}
                      </Link>
                    </td>
                    <td className={`${styles.td} ${styles.tdAction}`}>
                      <Link href={href} className={styles.cellLink}>
                        <ChevronRight size={14} className={styles.chev} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function CommBadge({ state }: { state: DeviceCommState }) {
  const cfg = COMM_CFG[state];
  return (
    <span className={`${styles.commBadge} ${styles[`comm_${state}`]}`}>
      <span className={styles.commDot} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

const COMM_CFG: Record<DeviceCommState, { label: string }> = {
  ONLINE: { label: "Online" },
  RECENT: { label: "Reciente" },
  STALE: { label: "Sin reportar" },
  LONG: { label: "7 días+" },
  OFFLINE: { label: "Offline" },
};

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `hace ${dd} d`;
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${m}/${d.getFullYear()}`;
}
