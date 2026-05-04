// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
// ═══════════════════════════════════════════════════════════════
//  Devices queries · global listing of trackers
//  ─────────────────────────────────────────────────────────────
//  Returns devices across the whole fleet, joined with the asset
//  they're installed on (if any). Comm state is derived from
//  lastSeenAt thresholds:
//    · ONLINE   < 5 min ago
//    · RECENT   < 30 min ago
//    · STALE    < 24 h ago
//    · LONG     < 7 d ago
//    · OFFLINE  ≥ 7 d ago (or never)
//
//  H2 expansion · DeviceStatus en el ciclo de vida (STOCK,
//  INSTALLED, IN_REPAIR, DECOMMISSIONED), assetId nullable,
//  vendor enum acotado, firmwareVersion, serialNumber.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

export type DeviceCommState =
  | "ONLINE"
  | "RECENT"
  | "STALE"
  | "LONG"
  | "OFFLINE";

export type DeviceVendor = "TELTONIKA" | "QUECLINK" | "CONCOX" | "OTHER";

export type DeviceLifecycleStatus =
  | "STOCK"
  | "INSTALLED"
  | "IN_REPAIR"
  | "DECOMMISSIONED";

export interface DeviceListRow {
  id: string;
  imei: string;
  serialNumber: string | null;
  vendor: DeviceVendor;
  model: string;
  firmwareVersion: string | null;
  status: DeviceLifecycleStatus;
  isPrimary: boolean;
  lastSeenAt: Date | null;
  installedAt: Date;
  asset: {
    id: string;
    name: string;
    plate: string | null;
    accountName: string | null;
  } | null;
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
  status?: DeviceLifecycleStatus | null;
  vendor?: DeviceVendor | null;
  primaryOnly?: boolean;
} = {}): Promise<DeviceListResult> {
  const where: any = {};
  if (opts.primaryOnly) where.isPrimary = true;
  if (opts.status) where.status = opts.status;
  if (opts.vendor) where.vendor = opts.vendor;
  if (opts.search) {
    where.OR = [
      { imei: { contains: opts.search } },
      { serialNumber: { contains: opts.search } },
      { model: { contains: opts.search } },
    ];
  }

  const [total, devices] = await Promise.all([
    db.device.count({ where }),
    db.device.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { isPrimary: "desc" },
        { vendor: "asc" },
        { imei: "asc" },
      ],
      select: {
        id: true,
        imei: true,
        serialNumber: true,
        vendor: true,
        model: true,
        firmwareVersion: true,
        status: true,
        isPrimary: true,
        lastSeenAt: true,
        installedAt: true,
        asset: {
          select: {
            id: true,
            name: true,
            plate: true,
            account: { select: { name: true } },
          },
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
      serialNumber: d.serialNumber,
      vendor: d.vendor as DeviceVendor,
      model: d.model,
      firmwareVersion: d.firmwareVersion,
      status: d.status as DeviceLifecycleStatus,
      isPrimary: d.isPrimary,
      lastSeenAt: d.lastSeenAt,
      installedAt: d.installedAt,
      asset: d.asset
        ? {
            id: d.asset.id,
            name: d.asset.name,
            plate: d.asset.plate,
            accountName: d.asset.account?.name ?? null,
          }
        : null,
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
  // H2 · agregamos counts por status del lifecycle
  stock: number;
  installed: number;
  inRepair: number;
  decommissioned: number;
}

export async function getDeviceCounts(): Promise<DeviceCounts> {
  const [total, primary, devicesAll, byStatus] = await Promise.all([
    db.device.count(),
    db.device.count({ where: { isPrimary: true } }),
    db.device.findMany({
      where: { status: "INSTALLED" },
      select: { lastSeenAt: true },
    }),
    db.device.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  // Comm state solo aplica a INSTALLED (los que están reportando)
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

  // Lifecycle counts
  const statusMap: Record<string, number> = {
    STOCK: 0,
    INSTALLED: 0,
    IN_REPAIR: 0,
    DECOMMISSIONED: 0,
  };
  for (const r of byStatus as { status: string; _count: { _all: number } }[]) {
    statusMap[r.status] = r._count._all;
  }

  return {
    total,
    online,
    recent,
    stale,
    long,
    offline,
    primary,
    stock: statusMap.STOCK ?? 0,
    installed: statusMap.INSTALLED ?? 0,
    inRepair: statusMap.IN_REPAIR ?? 0,
    decommissioned: statusMap.DECOMMISSIONED ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════
//  H2 · Helpers para drawer
// ═══════════════════════════════════════════════════════════════

export async function getDeviceForEdit(deviceId: string): Promise<{
  id: string;
  imei: string;
  serialNumber: string | null;
  vendor: DeviceVendor;
  model: string;
  firmwareVersion: string | null;
  status: DeviceLifecycleStatus;
  isPrimary: boolean;
  assetId: string | null;
  assetName: string | null;
  accountName: string | null;
} | null> {
  const d = await db.device.findUnique({
    where: { id: deviceId },
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          account: { select: { name: true } },
        },
      },
    },
  });
  if (!d) return null;
  return {
    id: d.id,
    imei: d.imei,
    serialNumber: d.serialNumber,
    vendor: d.vendor as DeviceVendor,
    model: d.model,
    firmwareVersion: d.firmwareVersion,
    status: d.status as DeviceLifecycleStatus,
    isPrimary: d.isPrimary,
    assetId: d.assetId,
    assetName: d.asset?.name ?? null,
    accountName: d.asset?.account?.name ?? null,
  };
}

/**
 * Lista de assets para asignar un device · simple, sin filtros
 * de cliente porque el actor (SA/MA) puede ver todos.
 */
export async function listAssetsForDeviceAssign(): Promise<
  { id: string; name: string; plate: string | null; accountName: string }[]
> {
  const assets = await db.asset.findMany({
    select: {
      id: true,
      name: true,
      plate: true,
      account: { select: { name: true } },
    },
    orderBy: [{ account: { name: "asc" } }, { name: "asc" }],
  });
  return assets.map((a) => ({
    id: a.id,
    name: a.name,
    plate: a.plate,
    accountName: a.account.name,
  }));
}
