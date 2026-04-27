"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import styles from "./TimelineScrubber.module.css";

// ═══════════════════════════════════════════════════════════════
//  TimelineScrubber · Sub-lote 3.4 · with stability fixes
//  ─────────────────────────────────────────────────────────────
//  Time slider for route playback. Controls cursor position
//  (0..1) which the parent translates into a Date and feeds to
//  RouteMap and other panels.
//
//  Features:
//    · Range input (drag to seek)
//    · Play / pause / skip start / skip end buttons
//    · Jump-to-prev-event / jump-to-next-event buttons
//    · Playback speed (1× / 10× / 60× / 300× / 2000×)
//    · Live time display (HH:MM:SS)
//
//  Stability fixes vs previous version:
//    1. The rAF effect no longer depends on `cursor` — it reads
//       the latest cursor via a ref. This avoids cancel/restart
//       on every tick which was causing oscillation.
//    2. State update is throttled to one rAF per frame to keep
//       parent re-renders smooth.
// ═══════════════════════════════════════════════════════════════

export interface ScrubberEventMarker {
  /** Fraction in [0,1] of the day's timeline */
  frac: number;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface TimelineScrubberProps {
  startAt: Date;
  endAt: Date;
  /** Position in [0,1]. Driven externally so parent owns the source of truth. */
  cursor: number;
  onCursorChange: (next: number) => void;
  /** Optional event markers for the prev/next buttons + visual ticks on the rail */
  eventMarkers?: ScrubberEventMarker[];
}

// New multipliers (per ADR-009 followup):
//   2000× → 1 day in ~43 seconds (overview)
//    300× → 1 day in ~5 minutes  (review)
//     60× → 1 hour in ~1 minute  (segment review)
//     10× → near-real-time replay
//      1× → real-time
const SPEEDS: { label: string; value: number }[] = [
  { label: "1×", value: 1 },
  { label: "10×", value: 10 },
  { label: "60×", value: 60 },
  { label: "300×", value: 300 },
  { label: "2000×", value: 2000 },
];

export function TimelineScrubber({
  startAt,
  endAt,
  cursor,
  onCursorChange,
  eventMarkers = [],
}: TimelineScrubberProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);

  // Refs that mirror state so the rAF loop reads fresh values
  // without needing to re-subscribe whenever they change.
  const cursorRef = useRef(cursor);
  const speedRef = useRef(speed);
  const onChangeRef = useRef(onCursorChange);
  cursorRef.current = cursor;
  speedRef.current = speed;
  onChangeRef.current = onCursorChange;

  const lastTickRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const totalMs = endAt.getTime() - startAt.getTime();
  const cursorTime = new Date(startAt.getTime() + cursor * totalMs);

  // ── Animation loop ────────────────────────────────────────
  // KEY FIX: only depends on `playing` and `totalMs`. Other values
  // (cursor, speed, callback) are read via refs so we don't cancel
  // and restart the rAF on every tick.
  useEffect(() => {
    if (!playing) return;

    let cancelled = false;
    lastTickRef.current = performance.now();

    function tick(now: number) {
      if (cancelled) return;
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      const advanceMs = dt * speedRef.current;
      const advanceFrac = advanceMs / totalMs;
      const next = Math.min(1, cursorRef.current + advanceFrac);
      onChangeRef.current(next);
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, totalMs]);

  // ── Transport actions ─────────────────────────────────────

  function togglePlay() {
    if (cursorRef.current >= 1) onChangeRef.current(0);
    setPlaying((p) => !p);
  }

  function skipStart() {
    onChangeRef.current(0);
    setPlaying(false);
  }

  function skipEnd() {
    onChangeRef.current(1);
    setPlaying(false);
  }

  function jumpToNextEvent() {
    if (eventMarkers.length === 0) return;
    const cur = cursorRef.current;
    // tiny epsilon so we don't get stuck on the current event
    const nextEv = eventMarkers
      .map((m) => m.frac)
      .filter((f) => f > cur + 0.0005)
      .sort((a, b) => a - b)[0];
    if (nextEv !== undefined) {
      onChangeRef.current(nextEv);
    }
  }

  function jumpToPrevEvent() {
    if (eventMarkers.length === 0) return;
    const cur = cursorRef.current;
    const prevEv = eventMarkers
      .map((m) => m.frac)
      .filter((f) => f < cur - 0.0005)
      .sort((a, b) => b - a)[0];
    if (prevEv !== undefined) {
      onChangeRef.current(prevEv);
    }
  }

  return (
    <div className={styles.wrap}>
      {/* ── Time labels header ──────────────────────────────── */}
      <div className={styles.timeHeader}>
        <span className={styles.timeLabel}>{formatTime(startAt)}</span>
        <span className={styles.timeLabel}>{formatTime(endAt)}</span>
      </div>

      {/* ── Slider row · full width ─────────────────────────── */}
      <div className={styles.sliderTrack}>
        {/* Event markers as small ticks on the track */}
        {eventMarkers.map((m, i) => (
          <span
            key={i}
            className={`${styles.eventTick} ${
              m.severity ? styles[`tick${m.severity}`] : ""
            }`}
            style={{ left: `${m.frac * 100}%` }}
            aria-hidden="true"
          />
        ))}
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(cursor * 1000)}
          onChange={(e) => {
            onCursorChange(Number(e.target.value) / 1000);
            setPlaying(false);
          }}
          className={styles.slider}
        />
      </div>

      {/* ── Controls row ────────────────────────────────────── */}
      <div className={styles.controlsRow}>
        <div className={styles.cursorTime}>
          <span className={styles.cursorTimeNum}>
            {formatTime(cursorTime)}
          </span>
          <span className={styles.cursorTimeLabel}>posición</span>
        </div>

        <div className={styles.transport}>
          <button
            type="button"
            className={styles.btn}
            onClick={skipStart}
            aria-label="Volver al inicio"
            title="Inicio"
          >
            <SkipBack size={13} />
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={jumpToPrevEvent}
            aria-label="Evento anterior"
            title="Evento anterior"
            disabled={eventMarkers.length === 0}
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={togglePlay}
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={jumpToNextEvent}
            aria-label="Evento siguiente"
            title="Evento siguiente"
            disabled={eventMarkers.length === 0}
          >
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={skipEnd}
            aria-label="Ir al final"
            title="Final"
          >
            <SkipForward size={13} />
          </button>
        </div>

        <div className={styles.speedGroup}>
          <span className={styles.speedLabel}>Velocidad</span>
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`${styles.speedBtn} ${
                speed === s.value ? styles.speedBtnActive : ""
              }`}
              onClick={() => setSpeed(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
