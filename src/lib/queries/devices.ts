// ═══════════════════════════════════════════════════════════════
//  Devices queries · global listing of trackers
//  ─────────────────────────────────────────────────────────────
//  Returns Teltonika devices across the whole fleet, joined with
//  the asset they're installed on. Comm state is derived from
//  lastSeenAt thresholds:
//    · ONLINE   < 5 min ago
//    · RECENT   < 30 min ago
//    · STALE    < 24 h ago
//    · LONG     < 7 d ago
//    · OFFLINE  ≥ 7 d ago (or never)
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

export type DeviceCommState =
  | "ONLINE"
  | "RECENT"
  | "STALE"
  | "LONG"
  | "OFFLINE";

export interface DeviceListRow {
  id: string;
  imei: string;
  vendor: string;
  model: string;
  isPrimary: boolean;
  lastSeenAt: Date | null;
  installedAt: Date;
  asset: {
    id: string;
    name: string;
    plate: string | null;
  };
  commState: DeviceCommState;
  msSinceLastSeen: number;
}

export interface DeviceListResult {
  rows: DeviceListRow[];
  total: number;
}

function classifyComm(msAgo: number): DeviceCommState {
  if (msAgo === Infinity) return "OFFLINE";
  if (msAgo < 5 * 60 * 1000) return "ONLINE";
  if (msAgo < 30 * 60 * 1000) return "RECENT";
  if (msAgo < 24 * 60 * 60 * 1000) return "STALE";
  if (msAgo < 7 * 24 * 60 * 60 * 1000) return "LONG";
  return "OFFLINE";
}

export async function listDevices(opts: {
  search?: string | null;
  commState?: DeviceCommState | null;
  primaryOnly?: boolean;
} = {}): Promise<DeviceListResult> {
  const where: any = {};
  if (opts.primaryOnly) where.isPrimary = true;
  if (opts.search) {
    where.OR = [
      { imei: { contains: opts.search } },
      { vendor: { contains: opts.search } },
      { model: { contains: opts.search } },
    ];
  }

  const [total, devices] = await Promise.all([
    db.device.count({ where }),
    db.device.findMany({
      where,
      orderBy: [{ isPrimary: "desc" }, { vendor: "asc" }, { imei: "asc" }],
      select: {
        id: true,
        imei: true,
        vendor: true,
        model: true,
        isPrimary: true,
        lastSeenAt: true,
        installedAt: true,
        asset: {
          select: { id: true, name: true, plate: true },
        },
      },
    }),
  ]);

  const now = Date.now();
  let rows: DeviceListRow[] = (devices as any[]).map((d) => {
    const msAgo = d.lastSeenAt ? now - d.lastSeenAt.getTime() : Infinity;
    return {
      id: d.id,
      imei: d.imei,
      vendor: d.vendor,
      model: d.model,
      isPrimary: d.isPrimary,
      lastSeenAt: d.lastSeenAt,
      installedAt: d.installedAt,
      asset: d.asset,
      commState: classifyComm(msAgo),
      msSinceLastSeen: msAgo === Infinity ? 0 : msAgo,
    };
  });

  if (opts.commState) {
    rows = rows.filter((r) => r.commState === opts.commState);
  }

  return { rows, total: opts.commState ? rows.length : total };
}

export interface DeviceCounts {
  total: number;
  online: number;
  recent: number;
  stale: number;
  long: number;
  offline: number;
  primary: number;
}

export async function getDeviceCounts(): Promise<DeviceCounts> {
  const [total, primary, devicesAll] = await Promise.all([
    db.device.count(),
    db.device.count({ where: { isPrimary: true } }),
    db.device.findMany({
      select: { lastSeenAt: true },
    }),
  ]);

  const now = Date.now();
  let online = 0,
    recent = 0,
    stale = 0,
    long = 0,
    offline = 0;
  for (const d of devicesAll as { lastSeenAt: Date | null }[]) {
    const msAgo = d.lastSeenAt ? now - d.lastSeenAt.getTime() : Infinity;
    const state = classifyComm(msAgo);
    if (state === "ONLINE") online++;
    else if (state === "RECENT") recent++;
    else if (state === "STALE") stale++;
    else if (state === "LONG") long++;
    else offline++;
  }

  return { total, online, recent, stale, long, offline, primary };
}
