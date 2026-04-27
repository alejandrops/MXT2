"use client";

import { useEffect, useRef, useState } from "react";
import type {
  TrajectoryEvent,
  TrajectoryPoint,
} from "@/lib/queries/historicos";
import { EVENT_TYPE_LABEL } from "@/lib/format";
import type { MapLayer } from "./MapLayerToggle";
import { TILE_SOURCES } from "./mapTileSources";
import styles from "./RouteMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  RouteMap · Históricos route + replay map
//  ─────────────────────────────────────────────────────────────
//  Leaflet map showing:
//    · Polyline of the asset's route through the day
//    · Event pins (color-coded by severity)
//    · Animated cursor marker following the timeline
//    · Optional highlighted trip (start/end markers + bold polyline
//      over the rest dimmed)
//    · Optional highlighted stop (pulsing marker)
//    · Configurable tile layer (Standard / B&W / Satellite)
// ═══════════════════════════════════════════════════════════════

export interface SelectedTripHighlight {
  startIdx: number;
  endIdx: number;
  /** Triggered each time selection changes — used to fit-to-bounds */
  nonce: number;
}

export interface SelectedStopHighlight {
  lat: number;
  lng: number;
  /** Triggered each time selection changes — used to pan/zoom */
  nonce: number;
  durationMs?: number;
}

interface RouteMapProps {
  points: TrajectoryPoint[];
  events: TrajectoryEvent[];
  cursorTime: Date | null;
  /** When set, pan the map to this lat/lng if it's outside view. */
  panTarget?: { lat: number; lng: number; nonce: number } | null;
  /** Basemap layer · controlled by parent */
  layer?: MapLayer;
  /** Optional trip to highlight on the map */
  selectedTrip?: SelectedTripHighlight | null;
  /** Optional stop to highlight on the map */
  selectedStop?: SelectedStopHighlight | null;
}

export default function RouteMap({
  points,
  events,
  cursorTime,
  panTarget,
  layer = "STANDARD",
  selectedTrip = null,
  selectedStop = null,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Leaflet objects we keep alive across renders
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const tripPolylineRef = useRef<any>(null);
  const tripStartMarkerRef = useRef<any>(null);
  const tripEndMarkerRef = useRef<any>(null);
  const stopMarkerRef = useRef<any>(null);
  const cursorMarkerRef = useRef<any>(null);
  const eventMarkersRef = useRef<any[]>([]);
  const tileLayerRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const LRef = useRef<any>(null);
  const fittedDatasetRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Init: create map once ─────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      // CSS injected once
      if (typeof document !== "undefined") {
        const id = "leaflet-css";
        if (!document.getElementById(id)) {
          const link = document.createElement("link");
          link.id = id;
          link.rel = "stylesheet";
          link.href =
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }
      }

      if (cancelled || !containerRef.current) return;

      LRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      });
      mapRef.current = map;

      // Default view (overridden by polyline effect when points load)
      map.setView([-34.6037, -58.3816], 10);

      // invalidateSize fix for flex containers
      requestAnimationFrame(() => {
        setTimeout(() => map.invalidateSize(true), 60);
        setTimeout(() => map.invalidateSize(true), 350);
      });
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        const ro = new ResizeObserver(() => map.invalidateSize(false));
        ro.observe(containerRef.current);
        resizeObserverRef.current = ro;
      }

      // Signal readiness so dependent effects can run
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply tile layer from prop ─────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    const source = TILE_SOURCES[layer];
    const newLayer = L.tileLayer(source.url, {
      attribution: source.attribution,
      maxZoom: source.maxZoom ?? 19,
      subdomains: source.subdomains ?? "abc",
    });
    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [mapReady, layer]);

  // ── Update polyline & event pins when data changes ────────
  // Depends on mapReady so it doesn't run before map exists.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    // Remove existing polyline & event markers
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    for (const m of eventMarkersRef.current) {
      map.removeLayer(m);
    }
    eventMarkersRef.current = [];

    if (points.length === 0) return;

    // Polyline · base route. When a trip is highlighted, the
    // base polyline becomes faint and a separate bold polyline
    // is drawn over the trip's segment (see selectedTrip effect).
    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
    polylineRef.current = L.polyline(latlngs, {
      color: "#1e3a8a",
      weight: 3,
      opacity: selectedTrip ? 0.20 : 0.75,
    }).addTo(map);

    // Fit to route ONLY on the first draw of a given dataset.
    // We use a fingerprint of the points (count + first/last
    // coords) so a new asset/date triggers a refit, but cursor
    // ticks within the same dataset don't yank the user out of
    // their pan/zoom.
    const datasetKey = points.length > 0
      ? `${points.length}:${points[0]!.lat},${points[0]!.lng}:${points[points.length - 1]!.lat},${points[points.length - 1]!.lng}`
      : "";
    if (fittedDatasetRef.current !== datasetKey) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [30, 30] });
      fittedDatasetRef.current = datasetKey;
    }

    // Event pins
    for (const ev of events) {
      if (ev.lat == null || ev.lng == null) continue;
      const color = severityColor(ev.severity);
      const icon = L.divIcon({
        className: "rm-event-pin",
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:${color};border:2px solid white;
          box-shadow:0 0 0 1px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([ev.lat, ev.lng], { icon });
      marker.bindPopup(
        `<strong>${EVENT_TYPE_LABEL[ev.type] ?? ev.type}</strong><br/>` +
          `${formatTime(ev.occurredAt)} · ${ev.severity}`,
      );
      marker.addTo(map);
      eventMarkersRef.current.push(marker);
    }
  }, [mapReady, points, events]);

  // ── Update cursor marker on cursorTime change ─────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    if (!cursorTime || points.length === 0) {
      if (cursorMarkerRef.current) {
        map.removeLayer(cursorMarkerRef.current);
        cursorMarkerRef.current = null;
      }
      return;
    }

    const sample = sampleAt(points, cursorTime);
    if (!sample) return;

    // Determine vehicle state at this moment
    const state = classifyState(sample.speedKmh, sample.ignition);
    const html = renderMarkerHtml(state, sample.heading);
    const icon = L.divIcon({
      className: "rm-cursor",
      html,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    if (!cursorMarkerRef.current) {
      cursorMarkerRef.current = L.marker([sample.lat, sample.lng], {
        icon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      cursorMarkerRef.current.setLatLng([sample.lat, sample.lng]);
      cursorMarkerRef.current.setIcon(icon);
    }
  }, [mapReady, cursorTime, points]);

  // ── Pan into view when panTarget changes ──────────────────
  // The parent emits a new panTarget (with a fresh nonce) when
  // the user clicks an event in the side panel. We only re-pan
  // if the target is outside the current map viewport — keeps
  // the experience subtle.
  useEffect(() => {
    if (!mapReady) return;
    if (!panTarget) return;
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const ll = [panTarget.lat, panTarget.lng] as [number, number];
    if (!bounds.contains(ll)) {
      map.panTo(ll, { animate: true });
    }
  }, [mapReady, panTarget]);

  // ── Highlight selected trip ────────────────────────────────
  // Draws a bold polyline over the trip's segment + start/end
  // markers. The base polyline is dimmed (handled in the polyline
  // effect above by reading selectedTrip).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    // Clean up any previous trip highlight
    if (tripPolylineRef.current) {
      map.removeLayer(tripPolylineRef.current);
      tripPolylineRef.current = null;
    }
    if (tripStartMarkerRef.current) {
      map.removeLayer(tripStartMarkerRef.current);
      tripStartMarkerRef.current = null;
    }
    if (tripEndMarkerRef.current) {
      map.removeLayer(tripEndMarkerRef.current);
      tripEndMarkerRef.current = null;
    }

    if (!selectedTrip || points.length === 0) return;

    const startIdx = Math.max(0, selectedTrip.startIdx);
    const endIdx = Math.min(points.length - 1, selectedTrip.endIdx);
    if (endIdx <= startIdx) return;

    const tripPts = points
      .slice(startIdx, endIdx + 1)
      .map((p) => [p.lat, p.lng] as [number, number]);

    // Bold polyline in highlight color
    tripPolylineRef.current = L.polyline(tripPts, {
      color: "#0891B2", // cyan · matches Maxtracker accent
      weight: 5,
      opacity: 1,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Start marker (green pin · "Inicio")
    const startP = points[startIdx]!;
    tripStartMarkerRef.current = L.marker([startP.lat, startP.lng], {
      icon: L.divIcon({
        className: "trip-start-marker",
        html: `<div style="
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #16a34a;
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px #16a34a, 0 2px 6px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          color: white; font-family: monospace; font-size: 11px;
          font-weight: 700;
        ">A</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 800,
    }).addTo(map);
    tripStartMarkerRef.current.bindTooltip("Inicio del viaje", {
      direction: "top",
      offset: [0, -10],
    });

    // End marker (red pin · "Fin")
    const endP = points[endIdx]!;
    tripEndMarkerRef.current = L.marker([endP.lat, endP.lng], {
      icon: L.divIcon({
        className: "trip-end-marker",
        html: `<div style="
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #dc2626;
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px #dc2626, 0 2px 6px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          color: white; font-family: monospace; font-size: 11px;
          font-weight: 700;
        ">B</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 800,
    }).addTo(map);
    tripEndMarkerRef.current.bindTooltip("Fin del viaje", {
      direction: "top",
      offset: [0, -10],
    });

    // Fit to trip bounds
    const bounds = L.latLngBounds(tripPts);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [mapReady, selectedTrip?.nonce, points]);

  // ── Highlight selected stop ────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    if (stopMarkerRef.current) {
      map.removeLayer(stopMarkerRef.current);
      stopMarkerRef.current = null;
    }

    if (!selectedStop) return;

    const dur = selectedStop.durationMs
      ? formatStopDuration(selectedStop.durationMs)
      : "Parada";

    stopMarkerRef.current = L.marker(
      [selectedStop.lat, selectedStop.lng],
      {
        icon: L.divIcon({
          className: "stop-marker",
          html: `<div style="position:relative;width:0;height:0;">
            <div style="
              position:absolute; left:-12px; top:-12px;
              width:24px; height:24px;
              border-radius:50%;
              background: rgba(217, 119, 6, 0.18);
              animation: stopMarkerPulse 1.6s ease-out infinite;
            "></div>
            <div style="
              position:absolute; left:-7px; top:-7px;
              width:14px; height:14px;
              border-radius:50%;
              background:#d97706;
              border:2.5px solid #fff;
              box-shadow:0 0 0 1px #d97706, 0 1px 4px rgba(0,0,0,0.3);
            "></div>
          </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        zIndexOffset: 700,
      },
    ).addTo(map);
    stopMarkerRef.current.bindTooltip(dur, {
      direction: "top",
      offset: [0, -16],
      permanent: true,
      className: "stop-tooltip",
    });

    // Pan/zoom to the stop
    map.setView([selectedStop.lat, selectedStop.lng], 17, {
      animate: true,
    });
  }, [mapReady, selectedStop?.nonce]);

  return <div ref={containerRef} className={styles.map} />;
}

// Format a stop duration (ms) into a human label like "12 min"
function formatStopDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return `${h} h ${String(remMin).padStart(2, "0")} min`;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

type VehicleState = "MOVING" | "IDLING" | "STOPPED";

function classifyState(
  speedKmh: number,
  ignition: boolean,
): VehicleState {
  if (speedKmh >= 5) return "MOVING";
  if (ignition) return "IDLING";
  return "STOPPED";
}

const MARKER_COLOR = "#1e3a8a"; // dark blue · neutral
const MARKER_OUTLINE = "#ffffff";

/**
 * Builds the inline SVG/HTML for the cursor marker depending on
 * the vehicle's current state. The wrapper div centers the shape
 * and provides a subtle halo. For MOVING, the play triangle is
 * rotated to point in the heading direction.
 */
function renderMarkerHtml(state: VehicleState, heading: number): string {
  const halo = `box-shadow: 0 0 0 2px rgba(30,58,138,0.18), 0 1px 4px rgba(0,0,0,0.25);`;
  const wrapStyle = `
    width:28px;height:28px;border-radius:50%;
    background:${MARKER_COLOR};
    display:flex;align-items:center;justify-content:center;
    border:2px solid ${MARKER_OUTLINE};
    ${halo}
  `;

  let inner = "";
  if (state === "MOVING") {
    // Play triangle rotated to heading. Heading is degrees (0 = north).
    // Triangle by default points "up" (north), so the rotation matches.
    inner = `
      <svg width="14" height="14" viewBox="0 0 14 14"
           style="transform:rotate(${heading}deg); transition: transform 0.15s linear;">
        <path d="M7 1 L12 12 L7 9.5 L2 12 Z"
              fill="${MARKER_OUTLINE}" stroke="${MARKER_OUTLINE}"
              stroke-width="0.8" stroke-linejoin="round"/>
      </svg>`;
  } else if (state === "IDLING") {
    // Pause icon: two vertical bars
    inner = `
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect x="2" y="2" width="3" height="8" fill="${MARKER_OUTLINE}" rx="0.5"/>
        <rect x="7" y="2" width="3" height="8" fill="${MARKER_OUTLINE}" rx="0.5"/>
      </svg>`;
  } else {
    // STOPPED: square
    inner = `
      <svg width="11" height="11" viewBox="0 0 11 11">
        <rect x="1.5" y="1.5" width="8" height="8" fill="${MARKER_OUTLINE}" rx="1"/>
      </svg>`;
  }

  return `<div style="${wrapStyle}">${inner}</div>`;
}

function severityColor(sev: string): string {
  switch (sev) {
    case "CRITICAL":
      return "#dc2626";
    case "HIGH":
      return "#ea580c";
    case "MEDIUM":
      return "#d97706";
    default:
      return "#6b7280";
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Given a list of points (sorted by recordedAt ASC) and a target
 * time, returns the interpolated position at that time INCLUDING
 * the surrounding speed/heading/ignition info needed to render
 * the contextual marker.
 */
function sampleAt(
  points: TrajectoryPoint[],
  target: Date,
): TrajectoryPoint | null {
  if (points.length === 0) return null;
  const t = target.getTime();
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (t <= first.recordedAt.getTime()) return first;
  if (t >= last.recordedAt.getTime()) return last;

  // Binary search for the bracketing pair
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.recordedAt.getTime() <= t) lo = mid;
    else hi = mid;
  }

  const a = points[lo]!;
  const b = points[hi]!;
  const span = b.recordedAt.getTime() - a.recordedAt.getTime();
  const frac = span === 0 ? 0 : (t - a.recordedAt.getTime()) / span;
  // Interpolate position smoothly. For speed/heading/ignition we
  // pick the prior point — those describe the segment we're on.
  return {
    lat: a.lat + (b.lat - a.lat) * frac,
    lng: a.lng + (b.lng - a.lng) * frac,
    recordedAt: new Date(a.recordedAt.getTime() + span * frac),
    speedKmh: a.speedKmh,
    heading: a.heading,
    ignition: a.ignition,
  };
}
