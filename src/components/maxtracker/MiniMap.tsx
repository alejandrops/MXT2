"use client";

import { useEffect, useRef } from "react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import { buildFleetMarkerHtml } from "./FleetMarker";
import styles from "./MiniMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  MiniMap · single-vehicle Leaflet map for the multi-map grid
//  ─────────────────────────────────────────────────────────────
//  Renders one vehicle centered on its current position. The map
//  pans to follow the vehicle as it moves (no manual zoom/pan
//  by the user — the cell is meant for passive supervision).
//
//  Each grid cell creates one of these. They share the same tile
//  layer URL but each has its own Leaflet instance · necessary
//  because Leaflet doesn't support reusing one map across multiple
//  containers.
//
//  Click on the map → bubbles up onClick (parent uses it to open
//  the detail panel for this asset).
// ═══════════════════════════════════════════════════════════════

const TILE_URLS = {
  STANDARD: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  BW: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
  SATELLITE:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
} as const;

const TILE_SUBDOMAINS = {
  STANDARD: "abc",
  BW: "abcd",
  SATELLITE: undefined,
} as const;

interface MiniMapProps {
  asset: FleetAssetLive | null;
  groupColor: string;
  layer: "STANDARD" | "BW" | "SATELLITE";
  showPlate: boolean;
  showTypeIcon: boolean;
  colorByFleet: boolean;
  zoom?: number;
  onClick?: () => void;
}

export function MiniMap({
  asset,
  groupColor,
  layer,
  showPlate,
  showTypeIcon,
  colorByFleet,
  zoom = 14,
  onClick,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const lastSnapshotRef = useRef<{
    motorState?: string;
    commState?: string;
    heading?: number;
    plate?: string | null;
  }>({});

  // ── Init map once ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: false,
        // Disable user interaction · these maps follow the vehicle
        // automatically and clicking should open the detail panel,
        // not pan around the cell.
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        maxZoom: 19,
      });
      mapRef.current = map;
      // Initial view · we'll center on the asset in the next effect
      map.setView([-34.6037, -58.3816], zoom);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tile layer · swap when 'layer' prop changes ───────────
  useEffect(() => {
    let attempts = 0;
    let cancelled = false;
    function apply() {
      const L = LRef.current;
      const map = mapRef.current;
      if (!L || !map) {
        if (cancelled || attempts > 100) return;
        attempts++;
        setTimeout(apply, 50);
        return;
      }
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      const url = TILE_URLS[layer];
      const subdomains = TILE_SUBDOMAINS[layer];
      const tile = L.tileLayer(url, {
        maxZoom: 19,
        ...(subdomains ? { subdomains } : {}),
      });
      tile.addTo(map);
      tileLayerRef.current = tile;
    }
    apply();
    return () => {
      cancelled = true;
    };
  }, [layer]);

  // ── Marker · create / update with the vehicle ─────────────
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !asset) return;

    const motor = asset.motorState;
    const comm = asset.commState;
    const heading = asset.heading;
    const plate = asset.plate;

    const html = buildFleetMarkerHtml({
      motor,
      comm,
      heading,
      groupColor,
      showPlate,
      plate,
      colorMode: colorByFleet ? "fleet" : "status",
      showTypeIcon,
      vehicleType: asset.vehicleType as any,
    });
    const markerSize = showTypeIcon ? 36 : 26;
    const iconHeight = showPlate ? markerSize + 18 : markerSize;
    const icon = L.divIcon({
      className: "fleet-marker",
      html,
      iconSize: [markerSize, iconHeight],
      iconAnchor: [markerSize / 2, markerSize / 2],
    });

    if (!markerRef.current) {
      markerRef.current = L.marker([asset.lat, asset.lng], { icon });
      markerRef.current.addTo(map);
    } else {
      markerRef.current.setLatLng([asset.lat, asset.lng]);
      const last = lastSnapshotRef.current;
      const changed =
        last.motorState !== motor ||
        last.commState !== comm ||
        Math.round((last.heading ?? 0) / 5) !== Math.round(heading / 5) ||
        last.plate !== plate;
      if (changed) {
        markerRef.current.setIcon(icon);
      }
    }
    lastSnapshotRef.current = { motorState: motor, commState: comm, heading, plate };

    // Pan map to follow the vehicle. We use setView (not panTo)
    // so the vehicle is always exactly centered.
    map.setView([asset.lat, asset.lng], map.getZoom(), {
      animate: false, // animation feels jittery at 4Hz updates
    });
  }, [asset, groupColor, showPlate, showTypeIcon, colorByFleet]);

  // ── Initial zoom (only when asset first arrives) ───────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !asset) return;
    map.setView([asset.lat, asset.lng], zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, zoom]);

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={styles.map}
        onClick={onClick}
      />
    </div>
  );
}
