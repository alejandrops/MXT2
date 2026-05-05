// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  Tracking queries · /seguimiento/mapa
//  ─────────────────────────────────────────────────────────────
//  Returns the latest known position + last comm time for every
//  mobile asset in the org. The page renders these on the map.
//
//  The "live" feel comes from the page calling this on a poll
//  interval; the simulated-movement server action mutates the
//  underlying timestamps so subsequent calls return moved assets.
// ═══════════════════════════════════════════════════════════════

// Communication thresholds · hardcoded for now per ADR-009.
// Eventually moved to /configuracion (account-level config).
//
// These match the legacy Maxtracker conventions:
//   ONLINE   < 5 min                     · device pinging recently
//   RECENT   5–45 min                    · normal idle / short break
//   STALE    45 min – 12 h               · long stop, possible issue
//   LONG     12 h – 48 h                 · likely device issue
//   NO_COMM  > 48 h                      · device not reporting
export const COMM_THRESHOLDS_MS = {
  ONLINE: 5 * 60 * 1000,
  RECENT: 45 * 60 * 1000,
  STALE: 12 * 60 * 60 * 1000,
  LONG: 48 * 60 * 60 * 1000,
} as const;

export type CommState = "ONLINE" | "RECENT" | "STALE" | "LONG" | "NO_COMM";

export function classifyComm(lastSeenMsAgo: number): CommState {
  if (lastSeenMsAgo < COMM_THRESHOLDS_MS.ONLINE) return "ONLINE";
  if (lastSeenMsAgo < COMM_THRESHOLDS_MS.RECENT) return "RECENT";
  if (lastSeenMsAgo < COMM_THRESHOLDS_MS.STALE) return "STALE";
  if (lastSeenMsAgo < COMM_THRESHOLDS_MS.LONG) return "LONG";
  return "NO_COMM";
}

export type MotorState = "MOVING" | "STOPPED" | "OFF";

export function classifyMotor(
  speedKmh: number,
  ignition: boolean,
): MotorState {
  if (speedKmh >= 5) return "MOVING";
  if (ignition) return "STOPPED";
  return "OFF";
}

export interface FleetAssetLive {
  id: string;
  name: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  vehicleType: string;
  groupId: string | null;
  groupName: string | null;
  // Last known position
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  ignition: boolean;
  recordedAt: Date;
  // Derived
  motorState: MotorState;
  commState: CommState;
  msSinceLastSeen: number;
  /** Asset has at least one OPEN alarm (any domain) · F3 */
  hasOpenAlarm: boolean;
  /** Total OPEN alarms count (any domain). 0 when hasOpenAlarm is false. */
  openAlarmCount: number;
  // Currently assigned driver (optional, may be null)
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    document: string | null;
    safetyScore: number;
  } | null;

  // ── S1-L3 mock-can · Telemática extendida CAN bus ─────────
  // Solo presente si el dispositivo del vehículo soporta CAN
  // (Teltonika FMC003/FMC130). Los assets con dispositivos legacy
  // o solo-GPS (FMB920) tienen estos campos en `null`/`undefined`.
  // Asignación determinística por assetId.
  /** Modelo del dispositivo telemático · informativo · siempre presente */
  deviceModel?: "FMC003" | "FMB920" | "FMC130" | "Legacy";
  /**
   * Snapshot de datos CAN del momento. null si el dispositivo no
   * tiene acceso al bus CAN. Cuando exista, contiene RPM, temp,
   * combustible, odómetro real, eventos de vehículo, DTC codes,
   * eco-score · todo validado por la ECU.
   *
   * Status: MOCK virtual hasta Sprint 2 (schema real).
   * Ver src/lib/mock-can/ para shape y generación.
   */
  canData?: import("@/lib/mock-can").CanSnapshot | null;
}

export interface FleetGroup {
  id: string;
  name: string;
  /** Stable color seed for the group (used by "color by flota" mode) */
  color: string;
}

// Deterministic color palette for groups · cycle through these.
// Picked to be perceptually distinct without being garish.
const GROUP_PALETTE = [
  "#2563eb", // blue
  "#0891b2", // cyan
  "#16a34a", // green
  "#ca8a04", // amber
  "#c2410c", // orange
  "#9333ea", // purple
  "#db2777", // pink
  "#475569", // slate
];

function colorForGroup(groupId: string | null): string {
  if (!groupId) return "#1e3a8a"; // default dark blue for "no group"
  // Stable hash: sum of char codes mod palette length
  let h = 0;
  for (let i = 0; i < groupId.length; i++) h = (h + groupId.charCodeAt(i)) | 0;
  return GROUP_PALETTE[Math.abs(h) % GROUP_PALETTE.length]!;
}

/**
 * Returns one record per mobile asset with its latest known
 * position and derived state. Assets that have never reported
 * are excluded (they wouldn't have a marker to show anyway).
 *
 * Implementation note: SQLite doesn't have window functions in
 * older versions, so we do this in two queries: list mobile
 * assets, then fetch the latest Position per asset. For ~80
 * assets this is cheap and avoids RAW SQL.
 */
export async function getFleetLive(
  now: Date = new Date(),
  accountId?: string | null,
): Promise<{
  assets: FleetAssetLive[];
  groups: FleetGroup[];
}> {
  const assetsRaw = await db.asset.findMany({
    where: {
      mobilityType: "MOBILE",
      ...(accountId ? { accountId } : {}),
    },
    select: {
      id: true,
      name: true,
      plate: true,
      make: true,
      model: true,
      vehicleType: true,
      groupId: true,
      group: {
        select: { id: true, name: true },
      },
      currentDriver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          document: true,
          safetyScore: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // F3 + openAlarmCount: collect counts of OPEN alarms per asset
  const openAlarmGroups = await db.alarm.groupBy({
    by: ["assetId"],
    where: { status: "OPEN" },
    _count: { _all: true },
  });
  const openAlarmCountByAsset = new Map<string, number>();
  for (const g of openAlarmGroups as Array<{
    assetId: string;
    _count: { _all: number };
  }>) {
    openAlarmCountByAsset.set(g.assetId, g._count._all);
  }

  // Latest position per asset (one query each · 80 round-trips
  // is fine for the scale we're at; if this grows we'd batch)
  const enriched = await Promise.all(
    assetsRaw.map(async (a: any) => {
      const last = await db.position.findFirst({
        where: { assetId: a.id },
        orderBy: { recordedAt: "desc" },
        select: {
          lat: true,
          lng: true,
          heading: true,
          speedKmh: true,
          ignition: true,
          recordedAt: true,
        },
      });
      if (!last) return null;
      const msSinceLastSeen = now.getTime() - last.recordedAt.getTime();
      return {
        id: a.id,
        name: a.name,
        plate: a.plate,
        make: a.make,
        model: a.model,
        vehicleType: a.vehicleType ?? "LIVIANO",
        groupId: a.groupId,
        groupName: a.group?.name ?? null,
        lat: last.lat,
        lng: last.lng,
        heading: last.heading ?? 0,
        speedKmh: last.speedKmh,
        ignition: last.ignition,
        recordedAt: last.recordedAt,
        motorState: classifyMotor(last.speedKmh, last.ignition),
        commState: classifyComm(msSinceLastSeen),
        msSinceLastSeen,
        hasOpenAlarm: (openAlarmCountByAsset.get(a.id) ?? 0) > 0,
        openAlarmCount: openAlarmCountByAsset.get(a.id) ?? 0,
        driver: a.currentDriver
          ? {
              id: a.currentDriver.id,
              firstName: a.currentDriver.firstName,
              lastName: a.currentDriver.lastName,
              document: a.currentDriver.document,
              safetyScore: a.currentDriver.safetyScore,
            }
          : null,
      } satisfies FleetAssetLive;
    }),
  );

  const assets = enriched.filter(
    (a): a is FleetAssetLive => a !== null,
  );

  // Build the groups list (unique by id)
  const groupsMap = new Map<string, FleetGroup>();
  for (const a of assets) {
    if (a.groupId && !groupsMap.has(a.groupId)) {
      groupsMap.set(a.groupId, {
        id: a.groupId,
        name: a.groupName ?? "Sin nombre",
        color: colorForGroup(a.groupId),
      });
    }
  }
  const groups = Array.from(groupsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return { assets, groups };
}

export { colorForGroup };

// ═══════════════════════════════════════════════════════════════
//  Day-replay mode
//  ─────────────────────────────────────────────────────────────
//  Instead of randomly simulating movement, we re-play the
//  vehicle's last available day of real telemetry as if it were
//  happening RIGHT NOW.
//
//  Strategy ("Option 3" per ADR-009 follow-up):
//    1. For each vehicle, find the LATEST date that has Position
//       rows. Call this its "replay day" (in local AR time).
//    2. Compute offset = today_local_midnight − replay_day_local_midnight.
//    3. At the page level, the client polls this list at intervals.
//       For each tick, the client maps "now" back to "replay time"
//       by subtracting offset, then shows the position from the
//       Position rows that match that replay time.
//
//  The replay is computed CLIENT-SIDE for smoothness — the server
//  just provides each vehicle's full day of positions plus the
//  offset. Then the client interpolates between samples on rAF.
// ═══════════════════════════════════════════════════════════════

export interface ReplayPoint {
  /** Original timestamp from the CSV / DB (when this ping happened) */
  recordedAt: Date;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  ignition: boolean;
}

export interface ReplayAsset {
  id: string;
  name: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  vehicleType: string;
  groupId: string | null;
  groupName: string | null;
  /**
   * Sorted by recordedAt ASC. Empty if the vehicle has no
   * position data anywhere.
   */
  points: ReplayPoint[];
  /**
   * Milliseconds to ADD to a "real now" timestamp to get the
   * corresponding replay-day timestamp. Negative values mean
   * the replay day is in the past.
   *
   *   replayTime = realNow + offsetMs
   */
  offsetMs: number;
  /** Asset has at least one OPEN alarm (any domain) · F3 */
  hasOpenAlarm: boolean;
  /** Total OPEN alarms count (any domain). 0 when hasOpenAlarm is false. */
  openAlarmCount: number;
  /** Currently assigned driver (optional, may be null) */
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    document: string | null;
    safetyScore: number;
  } | null;
}

export interface ReplayPayload {
  assets: ReplayAsset[];
  groups: FleetGroup[];
}

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Local AR midnight of a given UTC instant, returned as UTC ms.
 */
function localArMidnight(utcMs: number): number {
  const localMs = utcMs - AR_OFFSET_MS;
  const localMidnight = Math.floor(localMs / 86_400_000) * 86_400_000;
  return localMidnight + AR_OFFSET_MS; // back to UTC
}

/**
 * Loads a replay-mode payload: every mobile asset's full latest
 * day of positions + a time offset to map "now" → "replay day".
 *
 * Multi-tenant scoping (U1): accepts an optional `accountId`. The
 * caller (page.tsx) computes it via `resolveAccountScope` from the
 * session and passes it here. When set, the query restricts the
 * fleet to that account's assets only.
 *
 * Performance: we do one query per asset (~80) which is fine at
 * SQLite scale but should be batched for production Postgres.
 */
export async function getFleetReplay(
  now: Date = new Date(),
  accountId?: string | null,
): Promise<ReplayPayload> {
  const assetsRaw = await db.asset.findMany({
    where: {
      mobilityType: "MOBILE",
      ...(accountId ? { accountId } : {}),
    },
    select: {
      id: true,
      name: true,
      plate: true,
      make: true,
      model: true,
      vehicleType: true,
      groupId: true,
      group: { select: { id: true, name: true } },
      currentDriver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          document: true,
          safetyScore: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // F3 + openAlarmCount: counts of OPEN alarms per asset
  const openAlarmGroups = await db.alarm.groupBy({
    by: ["assetId"],
    where: { status: "OPEN" },
    _count: { _all: true },
  });
  const openAlarmCountByAsset = new Map<string, number>();
  for (const g of openAlarmGroups as Array<{
    assetId: string;
    _count: { _all: number };
  }>) {
    openAlarmCountByAsset.set(g.assetId, g._count._all);
  }

  // For each asset: find the latest position, then load all
  // positions of that local-AR day.
  const todayMidnight = localArMidnight(now.getTime());

  const enriched = await Promise.all(
    assetsRaw.map(async (a: any) => {
      const last = await db.position.findFirst({
        where: { assetId: a.id },
        orderBy: { recordedAt: "desc" },
        select: { recordedAt: true },
      });
      if (!last) {
        return null;
      }
      const replayDayMidnight = localArMidnight(last.recordedAt.getTime());
      const dayEnd = replayDayMidnight + 24 * 60 * 60 * 1000;
      const pointsRaw = await db.position.findMany({
        where: {
          assetId: a.id,
          recordedAt: {
            gte: new Date(replayDayMidnight),
            lt: new Date(dayEnd),
          },
        },
        orderBy: { recordedAt: "asc" },
        select: {
          recordedAt: true,
          lat: true,
          lng: true,
          heading: true,
          speedKmh: true,
          ignition: true,
        },
      });
      // ReplayPoint requiere heading: number · default 0 (norte)
      const points = pointsRaw.map((p) => ({
        ...p,
        heading: p.heading ?? 0,
      }));
      return {
        id: a.id,
        name: a.name,
        plate: a.plate,
        make: a.make,
        model: a.model,
        vehicleType: a.vehicleType ?? "LIVIANO",
        groupId: a.groupId,
        groupName: a.group?.name ?? null,
        points,
        offsetMs: replayDayMidnight - todayMidnight,
        hasOpenAlarm: (openAlarmCountByAsset.get(a.id) ?? 0) > 0,
        openAlarmCount: openAlarmCountByAsset.get(a.id) ?? 0,
        driver: a.currentDriver
          ? {
              id: a.currentDriver.id,
              firstName: a.currentDriver.firstName,
              lastName: a.currentDriver.lastName,
              document: a.currentDriver.document,
              safetyScore: a.currentDriver.safetyScore,
            }
          : null,
      } satisfies ReplayAsset;
    }),
  );

  const assets = enriched.filter((a): a is ReplayAsset => a !== null);

  // Build the groups list (unique by id)
  const groupsMap = new Map<string, FleetGroup>();
  for (const a of assets) {
    if (a.groupId && !groupsMap.has(a.groupId)) {
      groupsMap.set(a.groupId, {
        id: a.groupId,
        name: a.groupName ?? "Sin nombre",
        color: colorForGroup(a.groupId),
      });
    }
  }
  const groups = Array.from(groupsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return { assets, groups };
}
