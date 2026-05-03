"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import styles from "./DetailBlocks.module.css";

// ═══════════════════════════════════════════════════════════════
//  DetailBlocks · shared building blocks for sidebar panels
//  ─────────────────────────────────────────────────────────────
//  AssetDetailPanel (Mapa) and TelemetryPanel (Históricos) used
//  to duplicate the same SectionHeader / Row / Num / Dot / Driver
//  components in their own files. This module centralizes them
//  so both panels look and feel identical, and any future tweak
//  lands in one place.
//
//  Exports:
//    · <PanelShell>   · the outer aside with header bar
//    · <SectionHeader>
//    · <Row>          · label · value row with optional accent
//    · <Num>, <Unit>
//    · <Dot>          · binary on/off
//    · <CommDot>      · comm-state colored dot
//    · <DriverCard>   · standard driver block
//    · <PlaceholderHint>
//    · <CoordRow>     · lat/lng row helper
//    · helpers: commLabel, degToCardinal, speedAccent
// ═══════════════════════════════════════════════════════════════

// ── PanelShell ──────────────────────────────────────────────

export function PanelShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside className={`${styles.panel} ${className ?? ""}`}>{children}</aside>
  );
}

// ── SectionHeader ───────────────────────────────────────────

export function SectionHeader({
  label,
  right,
}: {
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionLabel}>{label}</span>
      {right && <span className={styles.sectionRight}>{right}</span>}
    </div>
  );
}

// ── Row ─────────────────────────────────────────────────────

export type RowAccent = "high" | "critical" | "warn" | "good";

export function Row({
  label,
  accent,
  dense,
  children,
}: {
  label: string;
  accent?: RowAccent;
  /** SCADA-style compact row · monospace + smaller padding */
  dense?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${styles.row} ${dense ? styles.rowDense : ""} ${
        accent ? styles[`accent_${accent}`] : ""
      }`}
    >
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{children}</span>
    </div>
  );
}

export function Rows({
  children,
  dense,
}: {
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <div className={`${styles.rows} ${dense ? styles.rowsDense : ""}`}>
      {children}
    </div>
  );
}

// ── Inline value primitives ─────────────────────────────────

export function Num({ children }: { children: React.ReactNode }) {
  return <span className={styles.num}>{children}</span>;
}

export function Unit({ children }: { children: React.ReactNode }) {
  return <span className={styles.unit}>{children}</span>;
}

export function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`${styles.dot} ${on ? styles.dotOn : styles.dotOff}`}
      aria-hidden="true"
    />
  );
}

export type CommState = "ONLINE" | "RECENT" | "STALE" | "LONG" | "NO_COMM";

export function CommDot({ state }: { state: CommState }) {
  return (
    <span
      className={`${styles.dot} ${styles[`comm_${state}`] ?? ""}`}
      aria-hidden="true"
    />
  );
}

export function CoordRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Row label={label}>
      <span className={styles.coords}>{value.toFixed(5)}</span>
    </Row>
  );
}

// ── DriverCard ──────────────────────────────────────────────

export interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string;
  document?: string | null;
  safetyScore: number;
}

export function DriverCard({ driver }: { driver: DriverInfo }) {
  const fullName = `${driver.firstName} ${driver.lastName}`;
  const initials = `${driver.firstName[0] ?? ""}${driver.lastName[0] ?? ""}`;
  const scoreClass =
    driver.safetyScore < 60
      ? styles.scoreRed
      : driver.safetyScore < 80
        ? styles.scoreAmb
        : styles.scoreGrn;

  return (
    <>
      <SectionHeader label="Conductor" />
      <Link
        href={`/objeto/conductor/${driver.id}`}
        className={styles.driverCard}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <span className={styles.driverInfo}>
          <span className={styles.driverName}>{fullName}</span>
          {driver.document && (
            <span className={styles.driverDoc}>DNI {driver.document}</span>
          )}
        </span>
        <span className={`${styles.scorePill} ${scoreClass}`}>
          {driver.safetyScore}
        </span>
        <ChevronRight size={14} className={styles.chev} />
      </Link>
    </>
  );
}

// ── Placeholder hint ────────────────────────────────────────

export function PlaceholderHint({ children }: { children: React.ReactNode }) {
  return <div className={styles.placeholderHint}>{children}</div>;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

export function speedAccent(speed: number): RowAccent | undefined {
  if (speed >= 130) return "critical";
  if (speed >= 110) return "high";
  return undefined;
}

const CARDINALS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSO",
  "SO",
  "OSO",
  "O",
  "ONO",
  "NO",
  "NNO",
];

export function degToCardinal(deg: number): string {
  const idx = Math.round((deg % 360) / 22.5) % 16;
  return CARDINALS[idx]!;
}

export function commLabel(msAgo: number): string {
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

// Re-export the styles object so panels can also use:
//   <header className={detailStyles.header}>
// etc., without re-declaring them.
export { styles as detailStyles };
