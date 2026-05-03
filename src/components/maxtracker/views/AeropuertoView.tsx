"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Search } from "lucide-react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import { EmptyState } from "../ui/EmptyState";
import styles from "./AeropuertoView.module.css";

// ═══════════════════════════════════════════════════════════════
//  AeropuertoView · listado denso estilo flight board
//  ─────────────────────────────────────────────────────────────
//  Tabla con todas las posiciones más recientes. Mono · alta
//  densidad. Filas con alarma OPEN destacadas en rojo. Click en
//  cualquier fila → 360 del vehículo.
//
//  Recibe `assets: FleetAssetLive[]` ya filtrados por el caller
//  (FleetTrackingClient ya aplica filterGroupIds/filterAssetIds).
// ═══════════════════════════════════════════════════════════════

interface Props {
  assets: FleetAssetLive[];
}

const STATUS_LABEL: Record<string, string> = {
  MOVING: "EN MARCHA",
  STOPPED: "DETENIDO",
  OFF: "APAGADO",
};

const COMM_LABEL: Record<string, string> = {
  ONLINE: "ONLINE",
  RECENT: "RECIENTE",
  STALE: "DEMORADO",
  LONG: "AUSENTE",
  NO_COMM: "SIN DATOS",
};

export function AeropuertoView({ assets }: Props) {
  const [search, setSearch] = useState("");
  const [filterAlarm, setFilterAlarm] = useState(false);
  const [filterMoving, setFilterMoving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (filterAlarm && !a.hasOpenAlarm) return false;
      if (filterMoving && a.motorState !== "MOVING") return false;
      if (q.length > 0) {
        const driverName = a.driver
          ? `${a.driver.firstName} ${a.driver.lastName}`
          : "";
        const hay =
          `${a.name} ${a.plate ?? ""} ${driverName} ${a.groupName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assets, search, filterAlarm, filterMoving]);

  return (
    <div className={styles.card}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vehículo, patente, conductor o grupo…"
            className={styles.search}
          />
        </div>
        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterBtn} ${
              filterMoving ? styles.filterActive : ""
            }`}
            onClick={() => setFilterMoving((v) => !v)}
          >
            En marcha
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${
              filterAlarm ? styles.filterActive : ""
            }`}
            onClick={() => setFilterAlarm((v) => !v)}
          >
            Solo con alarma
          </button>
          <span className={styles.count}>
            {filtered.length.toLocaleString("es-AR")} de{" "}
            {assets.length.toLocaleString("es-AR")}
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.alignRight}`}>#</th>
              <th className={styles.th}>Vehículo</th>
              <th className={styles.th}>Patente</th>
              <th className={styles.th}>Grupo</th>
              <th className={styles.th}>Estado</th>
              <th className={`${styles.th} ${styles.alignRight}`}>
                Vel · km/h
              </th>
              <th className={styles.th}>Comunicación</th>
              <th className={`${styles.th} ${styles.alignRight}`}>
                Última pos
              </th>
              <th className={styles.th}>Conductor</th>
              <th className={`${styles.th} ${styles.alignCenter}`}>Alarma</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <Row key={a.id} asset={a} idx={i + 1} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState
            title="Sin vehículos para los filtros activos"
            hint="Probá quitar restricciones para ver toda la flota."
            size="compact"
          />
        )}
      </div>
    </div>
  );
}

function Row({ asset: a, idx }: { asset: FleetAssetLive; idx: number }) {
  const href = `/objeto/vehiculo/${a.id}`;
  const speed = Math.round(a.speedKmh);
  const speedClass =
    a.motorState !== "MOVING"
      ? styles.dim
      : speed >= 130
        ? styles.speedRed
        : speed >= 110
          ? styles.speedAmb
          : styles.mono;

  return (
    <tr
      className={`${styles.row} ${a.hasOpenAlarm ? styles.rowAlarm : ""}`}
    >
      <td className={`${styles.td} ${styles.alignRight}`}>
        <Link href={href} className={styles.cellLink}>
          <span className={styles.dim}>{String(idx).padStart(3, "0")}</span>
        </Link>
      </td>
      <td className={styles.td}>
        <Link href={href} className={styles.cellLink}>
          <span className={styles.assetName}>{a.name}</span>
        </Link>
      </td>
      <td className={styles.td}>
        <Link href={href} className={styles.cellLink}>
          {a.plate ? (
            <span className={styles.plate}>{a.plate}</span>
          ) : (
            <span className={styles.dim}>—</span>
          )}
        </Link>
      </td>
      <td className={styles.td}>
        <Link href={href} className={styles.cellLink}>
          {a.groupName ? (
            <span className={styles.group}>{a.groupName}</span>
          ) : (
            <span className={styles.dim}>—</span>
          )}
        </Link>
      </td>
      <td className={styles.td}>
        <Link href={href} className={styles.cellLink}>
          <span
            className={`${styles.statusPill} ${
              a.motorState === "MOVING"
                ? styles.statusMoving
                : a.motorState === "STOPPED" && a.ignition
                  ? styles.statusIdle
                  : a.motorState === "STOPPED"
                    ? styles.statusStopped
                    : styles.statusOff
            }`}
          >
            {a.motorState === "STOPPED" && a.ignition
              ? "RALENTÍ"
              : STATUS_LABEL[a.motorState]}
          </span>
        </Link>
      </td>
      <td className={`${styles.td} ${styles.alignRight}`}>
        <Link href={href} className={styles.cellLink}>
          <span className={speedClass}>{speed}</span>
        </Link>
      </td>
      <td className={styles.td}>
        <Link href={href} className={styles.cellLink}>
          <span
            className={`${styles.commPill} ${
              a.commState === "ONLINE"
                ? styles.commOnline
                : a.commState === "RECENT"
                  ? styles.commRecent
                  : a.commState === "STALE"
                    ? styles.commStale
                    : a.commState === "LONG"
                      ? styles.commLong
                      : styles.commNone
            }`}
          >
            {COMM_LABEL[a.commState]}
          </span>
        </Link>
      </td>
      <td className={`${styles.td} ${styles.alignRight}`}>
        <Link href={href} className={styles.cellLink}>
          <span className={styles.monoSm}>
            {formatAgo(a.msSinceLastSeen)}
          </span>
        </Link>
      </td>
      <td className={styles.td}>
        <Link href={href} className={styles.cellLink}>
          {a.driver ? (
            <span className={styles.driver}>
              {a.driver.firstName} {a.driver.lastName}
            </span>
          ) : (
            <span className={styles.dim}>—</span>
          )}
        </Link>
      </td>
      <td className={`${styles.td} ${styles.alignCenter}`}>
        <Link href={href} className={styles.cellLink}>
          {a.hasOpenAlarm ? (
            <span className={styles.alarmBadge}>
              <AlertTriangle size={11} />
              {a.openAlarmCount}
            </span>
          ) : (
            <span className={styles.dim}>—</span>
          )}
        </Link>
      </td>
      <td className={`${styles.td} ${styles.alignRight}`}>
        <Link href={href} className={styles.cellLink}>
          <ChevronRight size={13} className={styles.chev} />
        </Link>
      </td>
    </tr>
  );
}

function formatAgo(ms: number): string {
  if (!Number.isFinite(ms) || ms > 1e15) return "—";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "<1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
