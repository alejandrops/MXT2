"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { TimelineScrubber } from "@/components/maxtracker/TimelineScrubber";
import { SegmentTimeline } from "@/components/maxtracker/SegmentTimeline";
import { MetricChart } from "@/components/maxtracker/MetricChart";
import { TripContextHeader } from "@/components/maxtracker/TripContextHeader";
import { TripDetailPanel } from "@/components/maxtracker/TripDetailPanel";
import { TelemetryPanel } from "@/components/maxtracker/TelemetryPanel";
import {
  MapLayerToggle,
  type MapLayer,
} from "@/components/maxtracker/MapLayerToggle";
import type {
  DailyTrajectory,
  Segment,
  TrajectoryEvent,
  TrajectoryPoint,
} from "@/lib/queries/historicos";
import styles from "./RoutePlayback.module.css";

// ═══════════════════════════════════════════════════════════════
//  RoutePlayback · Client wrapper for map + scrubber + side panel
//  ─────────────────────────────────────────────────────────────
//  Owns the cursor state shared across all 3 children.
//
//  Why we now own TripDetailPanel here too: clicking an event in
//  the panel needs to seek the cursor (so the map marker jumps
//  to that moment) and pan the map. Lifting the click handler up
//  here makes the data flow obvious.
//
//  Also owns the map layer (Standard / B&W / Satellite) and the
//  highlight state (selectedTrip + selectedStop) propagated to
//  RouteMap when the user clicks a segment in the side panel.
// ═══════════════════════════════════════════════════════════════

const RouteMap = dynamic(
  () => import("@/components/maxtracker/RouteMap"),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

interface RoutePlaybackProps {
  trajectory: DailyTrajectory;
}

export function RoutePlayback({ trajectory }: RoutePlaybackProps) {
  const { points, events, segments, stats } = trajectory;
  const startAt = stats.startAt;
  const endAt = stats.endAt;

  const [cursor, setCursor] = useState(0); // 0..1
  const [panTarget, setPanTarget] = useState<{
    lat: number;
    lng: number;
    nonce: number;
  } | null>(null);

  // Map layer · persists per surface
  const [mapLayer, setMapLayer] = useState<MapLayer>(() => {
    if (typeof window === "undefined") return "STANDARD";
    const saved = window.localStorage.getItem("historial-map-layer");
    if (saved === "STANDARD" || saved === "BW" || saved === "SATELLITE") {
      return saved;
    }
    return "STANDARD";
  });
  function handleLayerChange(next: MapLayer) {
    setMapLayer(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("historial-map-layer", next);
    }
  }

  // Highlight state · trip and stop (mutually exclusive)
  const [selectedTrip, setSelectedTrip] = useState<{
    startIdx: number;
    endIdx: number;
    nonce: number;
  } | null>(null);
  const [selectedStop, setSelectedStop] = useState<{
    lat: number;
    lng: number;
    durationMs: number;
    nonce: number;
  } | null>(null);

  // Re-hydrate Date objects (server→client serialization turned
  // them into strings/numbers).
  const hydratedPoints: TrajectoryPoint[] = points.map((p) => ({
    ...p,
    recordedAt: new Date(p.recordedAt),
  }));
  const hydratedEvents: TrajectoryEvent[] = events.map((e) => ({
    ...e,
    occurredAt: new Date(e.occurredAt),
  }));
  const hydratedSegments = segments.map((s) => ({
    ...s,
    startAt: new Date(s.startAt),
    endAt: new Date(s.endAt),
  }));
  const hydratedTrajectory: DailyTrajectory = {
    ...trajectory,
    points: hydratedPoints,
    events: hydratedEvents,
    segments: hydratedSegments,
    stats: {
      ...stats,
      startAt: stats.startAt ? new Date(stats.startAt) : null,
      endAt: stats.endAt ? new Date(stats.endAt) : null,
    },
  };
  const startDate = startAt ? new Date(startAt) : null;
  const endDate = endAt ? new Date(endAt) : null;

  // Click on an event in the side panel:
  //   1. Compute its fraction in [0,1] of the day's timeline
  //   2. Move the cursor (which the map will follow)
  //   3. Set panTarget so the map pans (only if outside view)
  const handleSeekToEvent = useCallback(
    (event: TrajectoryEvent) => {
      if (!startDate || !endDate) return;
      const totalMs = endDate.getTime() - startDate.getTime();
      if (totalMs <= 0) return;
      const evMs = new Date(event.occurredAt).getTime();
      const frac = Math.max(
        0,
        Math.min(1, (evMs - startDate.getTime()) / totalMs),
      );
      setCursor(frac);
      if (event.lat != null && event.lng != null) {
        setPanTarget({
          lat: event.lat,
          lng: event.lng,
          nonce: Date.now(),
        });
      }
    },
    [startDate, endDate],
  );

  // Click on a segment in the side panel · seeks to its start
  // and ALSO highlights the segment on the map:
  //   · TRIP  → highlight as a bold polyline + start/end markers
  //   · IDLE  → just seek (idle is a brief pause within a trip)
  //   · STOP  → highlight as a pulsing parking marker, fit to view
  const handleSeekToSegment = useCallback(
    (segment: Segment) => {
      if (!startDate || !endDate) return;
      const totalMs = endDate.getTime() - startDate.getTime();
      if (totalMs <= 0) return;
      const segMs = new Date(segment.startAt).getTime();
      const frac = Math.max(
        0,
        Math.min(1, (segMs - startDate.getTime()) / totalMs),
      );
      setCursor(frac);

      if (segment.kind === "TRIP") {
        // Find the indices into hydratedPoints that bracket the
        // segment start/end times. We want the bold polyline to
        // align tightly with what the user clicked.
        const startIdx = findClosestIdx(
          hydratedPoints,
          new Date(segment.startAt),
        );
        const endIdx = findClosestIdx(
          hydratedPoints,
          new Date(segment.endAt),
        );
        setSelectedTrip({
          startIdx,
          endIdx,
          nonce: Date.now(),
        });
        setSelectedStop(null);
        // Don't pan via panTarget — fitBounds inside RouteMap handles it
        return;
      }
      if (segment.kind === "STOP") {
        setSelectedStop({
          lat: segment.startLat,
          lng: segment.startLng,
          durationMs: segment.durationMs,
          nonce: Date.now(),
        });
        setSelectedTrip(null);
        return;
      }
      // IDLE · just seek and pan as before
      setPanTarget({
        lat: segment.startLat,
        lng: segment.startLng,
        nonce: Date.now(),
      });
    },
    [startDate, endDate, hydratedPoints],
  );

  // Empty state: no points means no day to show
  if (!startDate || !endDate || hydratedPoints.length === 0) {
    return (
      <div className={styles.layout}>
        <div className={styles.mapColumn}>
          <div className={styles.empty}>
            No hay datos de posición para este día. Probá con otro asset o fecha.
          </div>
        </div>
        <div className={styles.detailColumn}>
          <TripContextHeader trajectory={hydratedTrajectory} />
          <TripDetailPanel trajectory={hydratedTrajectory} />
        </div>
      </div>
    );
  }

  const totalMs = endDate.getTime() - startDate.getTime();
  const cursorTime = new Date(startDate.getTime() + cursor * totalMs);
  const liveSample = sampleAt(hydratedPoints, cursorTime);

  // Pre-compute event markers (fraction in [0,1] + severity)
  // for the scrubber to render ticks and enable prev/next jumps.
  const eventMarkers = hydratedEvents
    .map((e) => ({
      frac: Math.max(
        0,
        Math.min(
          1,
          (new Date(e.occurredAt).getTime() - startDate.getTime()) / totalMs,
        ),
      ),
      severity: e.severity,
    }))
    .sort((a, b) => a.frac - b.frac);

  return (
    <div className={styles.layout}>
      <div className={styles.mapColumn}>
        <div className={styles.mapWrap}>
          <RouteMap
            points={hydratedPoints}
            events={hydratedEvents}
            cursorTime={cursorTime}
            panTarget={panTarget}
            layer={mapLayer}
            selectedTrip={selectedTrip}
            selectedStop={selectedStop}
          />
          <div className={styles.mapControls}>
            <MapLayerToggle
              value={mapLayer}
              onChange={handleLayerChange}
            />
          </div>
        </div>
        <MetricChart
          points={hydratedPoints}
          startAt={startDate}
          endAt={endDate}
          cursor={cursor}
          onSeek={setCursor}
        />
        <SegmentTimeline
          segments={hydratedSegments}
          startAt={startDate}
          endAt={endDate}
          cursor={cursor}
          onSegmentClick={handleSeekToSegment}
        />
        <TimelineScrubber
          startAt={startDate}
          endAt={endDate}
          cursor={cursor}
          onCursorChange={setCursor}
          eventMarkers={eventMarkers}
        />
      </div>
      <div className={styles.detailColumn}>
        <TripContextHeader trajectory={hydratedTrajectory} />
        <TelemetryPanel
          sample={liveSample}
          points={hydratedPoints}
          startAt={startDate}
          driver={hydratedTrajectory.asset.currentDriver}
        />
        <TripDetailPanel
          trajectory={hydratedTrajectory}
          onEventClick={handleSeekToEvent}
          onSegmentClick={handleSeekToSegment}
        />
      </div>
    </div>
  );
}

/**
 * Returns the position sample at the given cursor time, with
 * lat/lng interpolated between bracketing points but speed/
 * heading/ignition taken from the prior point (those describe
 * the segment we're traversing).
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
  return {
    lat: a.lat + (b.lat - a.lat) * frac,
    lng: a.lng + (b.lng - a.lng) * frac,
    recordedAt: new Date(a.recordedAt.getTime() + span * frac),
    speedKmh: a.speedKmh,
    heading: a.heading,
    ignition: a.ignition,
  };
}

function MapPlaceholder() {
  return <div className={styles.mapLoading}>Cargando mapa…</div>;
}

/**
 * Binary-search the index of the point closest to a target time.
 * Used to translate segment startAt/endAt into polyline indices
 * for selectedTrip highlighting.
 */
function findClosestIdx(points: TrajectoryPoint[], target: Date): number {
  if (points.length === 0) return 0;
  const t = target.getTime();
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.recordedAt.getTime() < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
