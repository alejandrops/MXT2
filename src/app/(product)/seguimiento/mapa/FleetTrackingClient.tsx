"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  classifyComm,
  classifyMotor,
  type FleetAssetLive,
  type FleetGroup,
  type ReplayAsset,
} from "@/lib/queries/tracking";
import { FleetSidebar } from "@/components/maxtracker/FleetSidebar";
import { FleetFilterBar } from "@/components/maxtracker/FleetFilterBar";
import { AssetDetailPanel } from "@/components/maxtracker/AssetDetailPanel";
import {
  MapLayerToggle,
  type MapLayer,
} from "@/components/maxtracker/MapLayerToggle";
import {
  MapViewToggle,
  gridSlotCount,
  type GridLayout,
} from "@/components/maxtracker/MapViewToggle";
import { MultiMapGrid, type SelectionMode } from "@/components/maxtracker/MultiMapGrid";
import { VehicleSelectorModal } from "@/components/maxtracker/VehicleSelectorModal";
import {
  ViewOptionsPopover,
  DEFAULT_VIEW_OPTIONS,
  type ViewOptions,
} from "@/components/maxtracker/ViewOptionsPopover";
import styles from "./FleetTrackingClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetTrackingClient
//  ─────────────────────────────────────────────────────────────
//  Owns:
//    · liveAssets        (derived from replay each tick)
//    · viewOpts          (the 7 popover toggles)
//    · selectedId        (which asset is the "active" one)
//    · trailPoints       (recent samples of the selected asset)
//
//  When selectedId is null, the right sidebar shows FleetSidebar.
//  When non-null, it shows AssetDetailPanel for that vehicle.
// ═══════════════════════════════════════════════════════════════

const FleetMap = dynamic(() => import("@/components/maxtracker/FleetMap"), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder}>Cargando mapa…</div>,
});

const UPDATE_INTERVAL_MS = 250;
const TRAIL_WINDOW_MS = 60 * 60 * 1000; // last 1 hour

interface FleetTrackingClientProps {
  initialAssets: ReplayAsset[];
  groups: FleetGroup[];
}

export function FleetTrackingClient({
  initialAssets,
  groups,
}: FleetTrackingClientProps) {
  const replayAssets = useMemo<ReplayAsset[]>(
    () =>
      initialAssets.map((a) => ({
        ...a,
        points: a.points.map((p) => ({
          ...p,
          recordedAt: new Date(p.recordedAt),
        })),
      })),
    [initialAssets],
  );

  const [viewOpts, setViewOpts] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<
    { id: string; nonce: number } | null
  >(null);

  // Map layer (STANDARD / BW / SATELLITE) · persists across reloads
  const [mapLayer, setMapLayer] = useState<MapLayer>(() => {
    if (typeof window === "undefined") return "STANDARD";
    const saved = window.localStorage.getItem("maxtracker:mapLayer");
    if (saved === "BW" || saved === "SATELLITE" || saved === "STANDARD") {
      return saved;
    }
    return "STANDARD";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("maxtracker:mapLayer", mapLayer);
  }, [mapLayer]);

  // Grid layout (1 = single, 2x2..4x4 = multi-map mode)
  const [gridLayout, setGridLayout] = useState<GridLayout>(() => {
    if (typeof window === "undefined") return "1";
    const saved = window.localStorage.getItem("maxtracker:gridLayout");
    if (saved && ["1", "2x2", "2x3", "3x3", "3x4", "4x4"].includes(saved)) {
      return saved as GridLayout;
    }
    return "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("maxtracker:gridLayout", gridLayout);
  }, [gridLayout]);

  // Multi-map selection state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("auto");
  const [manualSelection, setManualSelection] = useState<string[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // ── Filter state · narrows visibleAssets (single-map and sidebar) ──
  // These are independent from manualSelection (which lives in the
  // multi-map modal) to keep the two surfaces from interfering.
  const [filterGroupIds, setFilterGroupIds] = useState<string[]>([]);
  const [filterAssetIds, setFilterAssetIds] = useState<string[]>([]);

  const [liveAssets, setLiveAssets] = useState<FleetAssetLive[]>(() =>
    replayAssets.map((a) => deriveLiveFromReplay(a, Date.now())),
  );

  const groupColorById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of groups) m[g.id] = g.color;
    return m;
  }, [groups]);

  // Replay tick · update live state every UPDATE_INTERVAL_MS
  const lastUpdateRef = useRef(0);
  useEffect(() => {
    let rafId: number;
    function tick() {
      const now = performance.now();
      if (now - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
        lastUpdateRef.current = now;
        const wallClock = Date.now();
        setLiveAssets(
          replayAssets.map((a) => deriveLiveFromReplay(a, wallClock)),
        );
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [replayAssets]);

  // KPI counts
  const kpis = useMemo(() => {
    let moving = 0;
    let stopped = 0;
    let off = 0;
    let noComm = 0;
    for (const a of liveAssets) {
      if (a.motorState === "MOVING") moving++;
      else if (a.motorState === "STOPPED") stopped++;
      else off++;
      if (a.commState === "NO_COMM") noComm++;
    }
    return { total: liveAssets.length, moving, stopped, off, noComm };
  }, [liveAssets]);

  const visibleAssets = useMemo(() => {
    return liveAssets.filter((a) => {
      // Comm filter (existing behaviour)
      if (!viewOpts.showNoComm && a.commState === "NO_COMM") return false;
      // Group filter
      if (
        filterGroupIds.length > 0 &&
        (!a.groupId || !filterGroupIds.includes(a.groupId))
      ) {
        return false;
      }
      // Asset filter
      if (
        filterAssetIds.length > 0 &&
        !filterAssetIds.includes(a.id)
      ) {
        return false;
      }
      return true;
    });
  }, [liveAssets, viewOpts.showNoComm, filterGroupIds, filterAssetIds]);

  // Selected asset (always from liveAssets so it updates each tick)
  const selectedAsset =
    selectedId !== null
      ? liveAssets.find((a) => a.id === selectedId) ?? null
      : null;

  // ── Compute trail points for the selected asset ──────────
  // We compute them from the replay data: the samples that fall
  // in the last TRAIL_WINDOW_MS of "replay time" (mapped from
  // the current wall clock).
  const trailPoints = useMemo(() => {
    if (!viewOpts.showTrail || !selectedId) return undefined;
    const ra = replayAssets.find((a) => a.id === selectedId);
    if (!ra || ra.points.length === 0) return undefined;
    const replayNow = Date.now() + ra.offsetMs;
    const replayStart = replayNow - TRAIL_WINDOW_MS;
    const result: Array<{ lat: number; lng: number }> = [];
    for (const p of ra.points) {
      const t = p.recordedAt.getTime();
      if (t >= replayStart && t <= replayNow) {
        result.push({ lat: p.lat, lng: p.lng });
      }
    }
    // Append current interpolated position so the line ends at
    // exactly the marker.
    if (selectedAsset) {
      result.push({ lat: selectedAsset.lat, lng: selectedAsset.lng });
    }
    return result;
  }, [
    viewOpts.showTrail,
    selectedId,
    replayAssets,
    // depend on liveAssets so the trail extends as time passes
    liveAssets,
    selectedAsset,
  ]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setFlyTarget({ id, nonce: Date.now() });
  }

  function handleBackToList() {
    setSelectedId(null);
  }

  return (
    <div className={styles.layout}>
      {/* Compact toolbar · KPIs left, live indicator + selectors right */}
      <div className={styles.kpiBand}>
        <Kpi label="total" value={kpis.total} />
        <Kpi label="en mov." value={kpis.moving} dotColor="#16a34a" />
        <Kpi label="detenidos" value={kpis.stopped} dotColor="#d97706" />
        <Kpi label="apagados" value={kpis.off} dotColor="#9ca3af" />
        <Kpi
          label="sin comm"
          value={kpis.noComm}
          dotColor="#6b7280"
          dimmed
        />
        <div className={styles.kpiSpacer} />
        <span
          className={styles.live}
          title="Datos actualizándose en vivo"
        >
          <span className={styles.liveDot} />
          en vivo
        </span>
        <div className={styles.kpiSep} />
        <MapViewToggle value={gridLayout} onChange={setGridLayout} />
        <ViewOptionsPopover value={viewOpts} onChange={setViewOpts} />
      </div>

      <FleetFilterBar
        assets={liveAssets}
        selectedGroupIds={filterGroupIds}
        selectedAssetIds={filterAssetIds}
        onChangeGroups={setFilterGroupIds}
        onChangeAssets={setFilterAssetIds}
      />

      <div className={styles.body}>
        <div className={styles.mapColumn}>
          {gridLayout === "1" ? (
            <div className={styles.mapWrap}>
              <FleetMap
                assets={visibleAssets}
                colorMode={viewOpts.colorByFleet ? "fleet" : "status"}
                showPlate={viewOpts.showPlate}
                cluster={viewOpts.groupVehicles}
                showTypeIcon={viewOpts.showVehicleTypeIcons}
                selectedAssetId={selectedId}
                onAssetSelect={handleSelect}
                flyTarget={flyTarget}
                groupColorById={groupColorById}
                trailPoints={trailPoints}
                layer={mapLayer}
              />
              <div className={styles.mapControls}>
                <MapLayerToggle value={mapLayer} onChange={setMapLayer} />
              </div>
            </div>
          ) : (
            <div className={styles.mapWrap}>
              <MultiMapGrid
                layout={gridLayout}
                allAssets={visibleAssets}
                selectedIds={manualSelection}
                selectionMode={selectionMode}
                groupColorById={groupColorById}
                layerName={mapLayer}
                showPlate={viewOpts.showPlate}
                showTypeIcon={viewOpts.showVehicleTypeIcons}
                colorByFleet={viewOpts.colorByFleet}
                onAssetClick={handleSelect}
                onOpenSelector={() => setSelectorOpen(true)}
              />
              <div className={styles.mapControls}>
                <MapLayerToggle value={mapLayer} onChange={setMapLayer} />
              </div>
            </div>
          )}
        </div>
        <div className={styles.sideColumn}>
          {selectedAsset ? (
            <AssetDetailPanel
              asset={selectedAsset}
              onBack={handleBackToList}
            />
          ) : (
            <FleetSidebar
              assets={visibleAssets}
              selectedId={selectedId}
              onSelect={handleSelect}
              groupColorById={groupColorById}
            />
          )}
        </div>
      </div>

      <VehicleSelectorModal
        open={selectorOpen}
        assets={liveAssets}
        initialMode={selectionMode}
        initialSelectedIds={manualSelection}
        onClose={() => setSelectorOpen(false)}
        onApply={(mode, ids) => {
          setSelectionMode(mode);
          setManualSelection(ids);
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

interface KpiProps {
  label: string;
  value: number;
  dotColor?: string;
  dimmed?: boolean;
}

function Kpi({ label, value, dotColor, dimmed }: KpiProps) {
  return (
    <div className={`${styles.kpi} ${dimmed ? styles.kpiDimmed : ""}`}>
      {dotColor && (
        <span
          className={styles.kpiDot}
          style={{ background: dotColor }}
          aria-hidden="true"
        />
      )}
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
    </div>
  );
}

function deriveLiveFromReplay(
  a: ReplayAsset,
  wallClockMs: number,
): FleetAssetLive {
  if (a.points.length === 0) {
    return {
      id: a.id,
      name: a.name,
      plate: a.plate,
      make: a.make,
      model: a.model,
      vehicleType: a.vehicleType,
      groupId: a.groupId,
      groupName: a.groupName,
      lat: 0,
      lng: 0,
      heading: 0,
      speedKmh: 0,
      ignition: false,
      recordedAt: new Date(wallClockMs),
      motorState: "OFF",
      commState: "NO_COMM",
      msSinceLastSeen: 1e10,
      driver: a.driver,
    };
  }

  const replayMs = wallClockMs + a.offsetMs;
  const first = a.points[0]!;
  const last = a.points[a.points.length - 1]!;
  const firstMs = first.recordedAt.getTime();
  const lastMs = last.recordedAt.getTime();

  if (replayMs <= firstMs) return finalize(a, first, wallClockMs, "STOPPED");
  if (replayMs >= lastMs) return finalize(a, last, wallClockMs, "OFF");

  let lo = 0;
  let hi = a.points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (a.points[mid]!.recordedAt.getTime() <= replayMs) lo = mid;
    else hi = mid;
  }
  const pa = a.points[lo]!;
  const pb = a.points[hi]!;
  const span = pb.recordedAt.getTime() - pa.recordedAt.getTime();
  const frac =
    span === 0 ? 0 : (replayMs - pa.recordedAt.getTime()) / span;

  const lat = pa.lat + (pb.lat - pa.lat) * frac;
  const lng = pa.lng + (pb.lng - pa.lng) * frac;
  const heading = pa.heading;
  const speedKmh = pa.speedKmh;
  const ignition = pa.ignition;
  const motorState = classifyMotor(speedKmh, ignition);

  return {
    id: a.id,
    name: a.name,
    plate: a.plate,
    make: a.make,
    model: a.model,
    vehicleType: a.vehicleType,
    groupId: a.groupId,
    groupName: a.groupName,
    lat,
    lng,
    heading,
    speedKmh,
    ignition,
    recordedAt: new Date(wallClockMs),
    motorState,
    commState: classifyComm(0),
    msSinceLastSeen: 0,
    driver: a.driver,
  };
}

function finalize(
  a: ReplayAsset,
  point: ReplayAsset["points"][number],
  wallClockMs: number,
  forceMotor: "STOPPED" | "OFF",
): FleetAssetLive {
  const replayMs = wallClockMs + a.offsetMs;
  const samplePoint = point.recordedAt.getTime();
  const msSinceSample = Math.max(0, replayMs - samplePoint);
  return {
    id: a.id,
    name: a.name,
    plate: a.plate,
    make: a.make,
    model: a.model,
    vehicleType: a.vehicleType,
    groupId: a.groupId,
    groupName: a.groupName,
    lat: point.lat,
    lng: point.lng,
    heading: point.heading,
    speedKmh: 0,
    ignition: false,
    recordedAt: new Date(wallClockMs),
    motorState: forceMotor,
    commState: classifyComm(msSinceSample),
    msSinceLastSeen: msSinceSample,
    driver: a.driver,
  };
}
