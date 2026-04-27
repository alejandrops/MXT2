"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight, Settings2 } from "lucide-react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import { GRID_SIZES, type GridLayout } from "./GridLayoutToggle";
import { MotorGlyph } from "./MotorGlyph";
import styles from "./MultiMapGrid.module.css";

// ═══════════════════════════════════════════════════════════════
//  MultiMapGrid · grid of MiniMaps for fleet supervision
//  ─────────────────────────────────────────────────────────────
//  Renders 4/6/9/12/16 mini Leaflet maps in a CSS grid. Each cell
//  has a header strip with vehicle name/plate/speed/status and a
//  small map below.
//
//  Two source modes for which vehicles fill the slots:
//    · "manual" · the user picks specific vehicles (selectedIds)
//    · "auto"   · system fills with vehicles in motion / with
//                 recent activity, refreshed periodically
//
//  Cycling: when there are MORE selected vehicles than slots,
//  rotates which ones are visible every CYCLE_MS milliseconds.
//  This is the "video wall" pattern · valuable for monitoring
//  larger fleets without losing visibility.
// ═══════════════════════════════════════════════════════════════

const MiniMap = dynamic(
  () => import("./MiniMap").then((m) => ({ default: m.MiniMap })),
  { ssr: false, loading: () => <div className={styles.cellLoading}>···</div> },
);

const CYCLE_MS = 8000; // 8 seconds per page when cycling

export type SelectionMode = "manual" | "auto";

interface MultiMapGridProps {
  layout: GridLayout;
  /** All currently visible/live assets · the universe to pick from */
  allAssets: FleetAssetLive[];
  /** Manually selected asset ids · used when mode === 'manual' */
  selectedIds: string[];
  selectionMode: SelectionMode;
  groupColorById: Record<string, string>;
  layerName: "STANDARD" | "BW" | "SATELLITE";
  showPlate: boolean;
  showTypeIcon: boolean;
  colorByFleet: boolean;
  onAssetClick: (id: string) => void;
  onOpenSelector: () => void;
}

export function MultiMapGrid({
  layout,
  allAssets,
  selectedIds,
  selectionMode,
  groupColorById,
  layerName,
  showPlate,
  showTypeIcon,
  colorByFleet,
  onAssetClick,
  onOpenSelector,
}: MultiMapGridProps) {
  const { rows, cols } = GRID_SIZES[layout];
  const slotCount = rows * cols;

  // ── Pool: which assets are eligible to fill slots ─────────
  // Manual mode → only those the user picked, in order
  // Auto mode → prioritize moving vehicles, then stopped, then off
  const pool: FleetAssetLive[] =
    selectionMode === "manual"
      ? selectedIds
          .map((id) => allAssets.find((a) => a.id === id))
          .filter((a): a is FleetAssetLive => Boolean(a))
      : autoSelectAssets(allAssets);

  // ── Cycling · rotate through pages every CYCLE_MS ────────
  // Number of pages = ceil(pool / slotCount). We only enable
  // cycling if pool is bigger than what fits.
  const totalPages = Math.max(1, Math.ceil(pool.length / slotCount));
  const [pageIndex, setPageIndex] = useState(0);
  // Reset page whenever the pool size or layout changes so we
  // don't get stuck pointing past the end.
  const lastSeenSizeRef = useRef({ pool: pool.length, slots: slotCount });
  useEffect(() => {
    if (
      lastSeenSizeRef.current.pool !== pool.length ||
      lastSeenSizeRef.current.slots !== slotCount
    ) {
      lastSeenSizeRef.current = { pool: pool.length, slots: slotCount };
      setPageIndex(0);
    }
  }, [pool.length, slotCount]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const t = setInterval(() => {
      setPageIndex((i) => (i + 1) % totalPages);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [totalPages]);

  // ── Slice the pool for the current page ──────────────────
  const start = pageIndex * slotCount;
  const visibleAssets = pool.slice(start, start + slotCount);

  // Pad with nulls so the grid has exactly slotCount cells
  const cells: Array<FleetAssetLive | null> = Array.from(
    { length: slotCount },
    (_, i) => visibleAssets[i] ?? null,
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.poolSize}>
            {pool.length}{" "}
            <span className={styles.poolSizeLabel}>
              {pool.length === 1 ? "vehículo" : "vehículos"} en supervisión
            </span>
          </span>
          {totalPages > 1 && (
            <span className={styles.cycleHint}>
              Página {pageIndex + 1} de {totalPages}
              <span className={styles.cycleDot} />
              rotando cada {CYCLE_MS / 1000}s
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.selectorBtn}
          onClick={onOpenSelector}
        >
          <Settings2 size={12} />
          {selectionMode === "auto"
            ? "Auto · seleccionar manual"
            : "Cambiar selección"}
        </button>
      </div>

      <div
        className={styles.grid}
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {cells.map((asset, idx) => (
          <div key={idx} className={styles.cell}>
            <header
              className={`${styles.cellHeader} ${
                asset ? "" : styles.cellHeaderEmpty
              }`}
            >
              {asset ? (
                <>
                  <span
                    className={`${styles.statusShape} ${
                      styles[`shape${asset.motorState}`]
                    }`}
                    style={{
                      background: colorByFleet
                        ? groupColorById[asset.groupId ?? ""] ?? "#1e3a8a"
                        : motorBg(asset.motorState),
                    }}
                    aria-hidden="true"
                  >
                    <MotorGlyph state={asset.motorState} size={9} />
                  </span>
                  <div className={styles.cellHeaderMain}>
                    <div className={styles.cellHeaderName}>
                      {asset.name}
                      {asset.plate && (
                        <span className={styles.cellHeaderPlate}>
                          {asset.plate}
                        </span>
                      )}
                    </div>
                    <div className={styles.cellHeaderMeta}>
                      <span
                        className={`${styles.commDot} ${
                          styles[`comm${asset.commState}`]
                        }`}
                      />
                      {asset.motorState === "MOVING" ? (
                        <span className={styles.speed}>
                          {Math.round(asset.speedKmh)} km/h
                        </span>
                      ) : (
                        <span className={styles.metaLabel}>
                          {motorLabel(asset.motorState)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.cellExpand}
                    onClick={() => onAssetClick(asset.id)}
                    title="Abrir detalle"
                  >
                    <ChevronRight size={13} />
                  </button>
                </>
              ) : (
                <span className={styles.cellEmptyLabel}>Sin vehículo</span>
              )}
            </header>
            <div className={styles.cellBody}>
              {asset ? (
                <MiniMap
                  asset={asset}
                  groupColor={
                    groupColorById[asset.groupId ?? ""] ?? "#1e3a8a"
                  }
                  layer={layerName}
                  showPlate={showPlate}
                  showTypeIcon={showTypeIcon}
                  colorByFleet={colorByFleet}
                  onClick={() => onAssetClick(asset.id)}
                />
              ) : (
                <div className={styles.cellPlaceholder}>
                  <span>Slot vacío</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Pick assets for "auto" mode. Order:
 *   1. MOVING (most interesting · they're doing things)
 *   2. STOPPED (idle · maybe at a delivery)
 *   3. OFF (least interesting but still valid)
 *
 * Within each tier, sort by name for stability.
 */
function autoSelectAssets(assets: FleetAssetLive[]): FleetAssetLive[] {
  const order: Record<string, number> = { MOVING: 0, STOPPED: 1, OFF: 2 };
  return [...assets].sort((a, b) => {
    const oa = order[a.motorState] ?? 99;
    const ob = order[b.motorState] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });
}

function motorBg(state: FleetAssetLive["motorState"]): string {
  if (state === "MOVING") return "#1e3a8a";
  if (state === "STOPPED") return "#475569";
  return "#9ca3af";
}

function motorLabel(state: FleetAssetLive["motorState"]): string {
  if (state === "MOVING") return "En movimiento";
  if (state === "STOPPED") return "Detenido";
  return "Apagado";
}
