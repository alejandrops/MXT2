"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import { MotorGlyph } from "./MotorGlyph";
import { EmptyState } from "./ui";
import styles from "./FleetSidebar.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetSidebar · the asset list next to the FleetMap
//  ─────────────────────────────────────────────────────────────
//  Shows every asset that's currently visible on the map, with:
//    · search input (matches name/plate/make/model)
//    · motor-state filter chips (Todos · En movimiento · Detenido · Apagado)
//    · density-friendly rows
//    · click → notifies parent so it flies the map to that asset
// ═══════════════════════════════════════════════════════════════

interface FleetSidebarProps {
  assets: FleetAssetLive[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  groupColorById: Record<string, string>;
}

type MotorFilter = "ALL" | "MOVING" | "STOPPED" | "OFF";

const FILTERS: { key: MotorFilter; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "MOVING", label: "En movimiento" },
  { key: "STOPPED", label: "Detenidos" },
  { key: "OFF", label: "Apagados" },
];

export function FleetSidebar({
  assets,
  selectedId,
  onSelect,
  groupColorById,
}: FleetSidebarProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MotorFilter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (filter !== "ALL" && a.motorState !== filter) return false;
      if (!q) return true;
      const tokens = q.split(/\s+/);
      const hay = [a.name, a.plate, a.make, a.model]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [assets, query, filter]);

  // Counts per filter (for chip badges)
  const counts = useMemo(() => {
    const c = { ALL: assets.length, MOVING: 0, STOPPED: 0, OFF: 0 };
    for (const a of assets) c[a.motorState]++;
    return c;
  }, [assets]);

  return (
    <aside className={styles.panel}>
      <div className={styles.searchRow}>
        <Search size={13} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Buscar vehículo, patente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar"
        />
      </div>

      <div className={styles.chips}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${styles.chip} ${
              filter === f.key ? styles.chipActive : ""
            }`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className={styles.chipCount}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState size="inline" title="Sin resultados" />
      ) : (
        <ul className={styles.list}>
          {filtered.map((a) => {
            const groupColor =
              (a.groupId && groupColorById[a.groupId]) || "#1e3a8a";
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className={`${styles.row} ${
                    selectedId === a.id ? styles.rowActive : ""
                  }`}
                  onClick={() => onSelect(a.id)}
                >
                  <span
                    className={`${styles.shape} ${
                      styles[`shape${a.motorState}`]
                    }`}
                    style={{ background: groupColor }}
                    aria-hidden="true"
                  >
                    <MotorGlyph state={a.motorState} size={10} />
                  </span>

                  <div className={styles.main}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{a.name}</span>
                      {a.plate && (
                        <span className={styles.plate}>{a.plate}</span>
                      )}
                    </div>
                    {a.driver && (
                      <div className={styles.driverLine}>
                        <span className={styles.driverName}>
                          {a.driver.firstName} {a.driver.lastName}
                        </span>
                      </div>
                    )}
                    <div className={styles.meta}>
                      <span
                        className={`${styles.commDot} ${
                          styles[`comm${a.commState}`]
                        }`}
                      />
                      <span className={styles.commLabel}>
                        {commLabel(a.msSinceLastSeen)}
                      </span>
                      {a.motorState === "MOVING" && (
                        <span className={styles.speed}>
                          {Math.round(a.speedKmh)} km/h
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className={styles.footer}>
        Mostrando {filtered.length} de {assets.length}
      </footer>
    </aside>
  );
}

function commLabel(msAgo: number): string {
  const sec = Math.floor(msAgo / 1000);
  if (sec < 30) return "hace instantes";
  if (sec < 60) return `hace ${sec} seg`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d${d === 1 ? "ía" : "ías"}`;
}
