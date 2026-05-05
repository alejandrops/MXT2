// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
// ═══════════════════════════════════════════════════════════════
//  Domain types
//  ─────────────────────────────────────────────────────────────
//  Re-exports Prisma-generated types and adds enriched domain
//  types that combine entities the way the UI consumes them.
//
//  Convention: types whose name contains the relations they
//  carry are explicit (e.g. AssetWithGroupAndDriver). Types that
//  represent "the natural row for screen X" are named after the
//  screen (e.g. AssetListRow).
// ═══════════════════════════════════════════════════════════════

import type {
  Account,
  Alarm,
  Asset,
  Device,
  Group,
  Person,
  Position,
} from "@prisma/client";

// Re-export Prisma base types for ergonomic imports
export type {
  Organization,
  Account,
  Group,
  Asset,
  Device,
  Person,
  Position,
  Event,
  Alarm,
  Tier,
  MobilityType,
  AssetStatus,
  EventType,
  Severity,
  AlarmType,
  AlarmStatus,
  AlarmDomain,
  VehicleType,
  // S4-L3a · módulo Conducción
  RoadType,
  Geofence,
  GeofenceCategory,
  Infraction,
  InfractionSeverity,
  InfractionStatus,
  DiscardReason,
} from "@prisma/client";

// ── Asset list row (Pantalla 2 · Lista A) ──────────────────────
export interface AssetListRow extends Asset {
  group: Pick<Group, "id" | "name"> | null;
  currentDriver: Pick<Person, "id" | "firstName" | "lastName" | "safetyScore"> | null;
  lastPosition: Pick<
    Position,
    "lat" | "lng" | "speedKmh" | "recordedAt" | "ignition"
  > | null;
}

// ── Asset detail (Pantalla 3 · Libro B) ────────────────────────
export interface AssetDetail extends Asset {
  account: Pick<Account, "id" | "name">;
  group: Pick<Group, "id" | "name"> | null;
  currentDriver: Person | null;
  devices: Device[];
  lastPosition: Position | null;
  // Aggregates over the last 30 days
  stats: {
    eventCount30d: number;
    alarmCount30d: number;
    openAlarms: number;
    // Period KPIs (last 30 days)
    km30d: number;
    activeMinutes30d: number;
    tripCount30d: number;
    /** Cumulative odometer reading · estimated from year of position data */
    odometerKm: number;
    /** Communication state computed from last position recordedAt */
    commState: "ONLINE" | "RECENT" | "STALE" | "LONG" | "NO_COMM";
    msSinceLastSeen: number;
  };
}

// ── Alarm with refs (Dashboard D + Libro B) ────────────────────
export interface AlarmWithRefs extends Alarm {
  asset: Pick<Asset, "id" | "name" | "plate">;
  person: Pick<Person, "id" | "firstName" | "lastName"> | null;
}

// ── Dashboard D KPI bundle ─────────────────────────────────────
export interface SafetyKpis {
  openAlarmsCount: number;
  criticalAssetsCount: number;
  events24hCount: number;
  fleetSafetyScore: number;
}

// ── Driver leaderboard row (worst-N panel on Dashboard D) ──────
export interface DriverScoreRow extends Pick<Person, "id" | "firstName" | "lastName" | "safetyScore"> {
  eventCount30d: number;
}

// ── Person detail (Sub-lote 3.3 · Libro del Conductor) ─────────
export interface PersonDetail extends Person {
  account: Pick<Account, "id" | "name">;
  // Currently driven assets (could be multiple)
  drivenAssets: Pick<Asset, "id" | "name" | "plate" | "make" | "model" | "status">[];
  // Aggregates over the last 30 days
  stats: {
    eventCount30d: number;
    alarmCount30d: number;
    openAlarms: number;
    lastEventAt: Date | null;
  };
  // Daily event histogram for the past 30 days, used by the
  // SVG sparkline in Overview tab.
  eventHistogram: { date: string; count: number }[];
}
