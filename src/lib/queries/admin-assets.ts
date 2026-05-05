// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
// ═══════════════════════════════════════════════════════════════
//  Admin assets queries · vista backoffice (H7c)
//  ─────────────────────────────────────────────────────────────
//  Diferencias con listAssets() del módulo Catálogos:
//   · Cross-cliente · sin scope (Maxtracker staff ve todo)
//   · Incluye info técnica · device asignado, sim asignada
//   · Sin trips ni driver-day rollups · es vista de gestión,
//     no operativa
//   · Filtros por · cliente, vendor del device, status del device
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

export type AdminAssetVehicleType =
  | "MOTOCICLETA"
  | "LIVIANO"
  | "UTILITARIO"
  | "PASAJEROS"
  | "CAMION_LIVIANO"
  | "CAMION_PESADO"
  | "SUSTANCIAS_PELIGROSAS"
  | "MAQUINA_VIAL"
  | "ASSET_FIJO";

export type AdminAssetStatus =
  | "MOVING"
  | "IDLE"
  | "STOPPED"
  | "OFFLINE"
  | "MAINTENANCE";

export interface AdminAssetRow {
  id: string;
  name: string;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicleType: AdminAssetVehicleType;
  status: AdminAssetStatus;
  account: { id: string; name: string };
  group: { id: string; name: string } | null;
  /** Primary device · null si no tiene */
  device: {
    id: string;
    imei: string;
    vendor: string;
    model: string;
    status: string;
    firmwareVersion: string | null;
    lastSeenAt: Date | null;
  } | null;
  /** SIM dentro del primary device · null si no hay */
  sim: {
    id: string;
    iccid: string;
    carrier: string;
    phoneNumber: string | null;
    status: string;
  } | null;
}

export interface AdminAssetListResult {
  rows: AdminAssetRow[];
  total: number;
}

export async function listAssetsForAdmin(opts: {
  search?: string | null;
  accountId?: string | null;
  vehicleType?: AdminAssetVehicleType | null;
  deviceVendor?: string | null;
  deviceStatus?: string | null;
  /** Si es 'no_device' filtra los que NO tienen device asignado */
  withoutDevice?: boolean;
  /** Página 1-indexed */
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminAssetListResult> {
  const where: any = {};
  if (opts.accountId) where.accountId = opts.accountId;
  if (opts.vehicleType) where.vehicleType = opts.vehicleType;
  if (opts.search) {
    where.OR = [
      { name: { contains: opts.search } },
      { plate: { contains: opts.search } },
      { vin: { contains: opts.search } },
    ];
  }
  if (opts.withoutDevice) {
    where.devices = { none: {} };
  } else if (opts.deviceVendor || opts.deviceStatus) {
    const deviceWhere: any = {};
    if (opts.deviceVendor) deviceWhere.vendor = opts.deviceVendor;
    if (opts.deviceStatus) deviceWhere.status = opts.deviceStatus;
    where.devices = { some: deviceWhere };
  }

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const [total, assets] = await Promise.all([
    db.asset.count({ where }),
    db.asset.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ account: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        plate: true,
        vin: true,
        make: true,
        model: true,
        year: true,
        vehicleType: true,
        status: true,
        account: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        devices: {
          where: { isPrimary: true },
          take: 1,
          select: {
            id: true,
            imei: true,
            vendor: true,
            model: true,
            status: true,
            firmwareVersion: true,
            lastSeenAt: true,
            sim: {
              select: {
                id: true,
                iccid: true,
                carrier: true,
                phoneNumber: true,
                status: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const rows: AdminAssetRow[] = (assets as any[]).map((a) => {
    const primary = a.devices?.[0] ?? null;
    return {
      id: a.id,
      name: a.name,
      plate: a.plate,
      vin: a.vin,
      make: a.make,
      model: a.model,
      year: a.year,
      vehicleType: a.vehicleType as AdminAssetVehicleType,
      status: a.status as AdminAssetStatus,
      account: a.account,
      group: a.group,
      device: primary
        ? {
            id: primary.id,
            imei: primary.imei,
            vendor: primary.vendor,
            model: primary.model,
            status: primary.status,
            firmwareVersion: primary.firmwareVersion,
            lastSeenAt: primary.lastSeenAt,
          }
        : null,
      sim: primary?.sim
        ? {
            id: primary.sim.id,
            iccid: primary.sim.iccid,
            carrier: primary.sim.carrier,
            phoneNumber: primary.sim.phoneNumber,
            status: primary.sim.status,
          }
        : null,
    };
  });

  return { rows, total };
}

export interface AdminAssetCounts {
  total: number;
  withDevice: number;
  withoutDevice: number;
  withoutSim: number;
}

export async function getAdminAssetCounts(): Promise<AdminAssetCounts> {
  const [total, withDevice, withoutSimDevice] = await Promise.all([
    db.asset.count(),
    db.asset.count({ where: { devices: { some: {} } } }),
    db.asset.count({
      where: {
        devices: {
          some: { simId: null, status: "INSTALLED" },
        },
      },
    }),
  ]);
  return {
    total,
    withDevice,
    withoutDevice: total - withDevice,
    withoutSim: withoutSimDevice,
  };
}

// ═══════════════════════════════════════════════════════════════
//  getAssetDetailForAdmin · datos completos para el drawer técnico
// ═══════════════════════════════════════════════════════════════

export async function getAssetDetailForAdmin(assetId: string): Promise<{
  id: string;
  name: string;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicleType: AdminAssetVehicleType;
  mobilityType: "MOBILE" | "FIXED";
  initialOdometerKm: number | null;
  status: AdminAssetStatus;
  account: { id: string; name: string; slug: string };
  group: { id: string; name: string } | null;
  currentDriver: { id: string; firstName: string; lastName: string } | null;
  devices: {
    id: string;
    imei: string;
    serialNumber: string | null;
    vendor: string;
    model: string;
    firmwareVersion: string | null;
    status: string;
    isPrimary: boolean;
    lastSeenAt: Date | null;
    installedAt: Date;
    sim: {
      id: string;
      iccid: string;
      phoneNumber: string | null;
      carrier: string;
      apn: string;
      dataPlanMb: number;
      status: string;
    } | null;
  }[];
} | null> {
  const a = await db.asset.findUnique({
    where: { id: assetId },
    include: {
      account: { select: { id: true, name: true, slug: true } },
      group: { select: { id: true, name: true } },
      currentDriver: {
        select: { id: true, firstName: true, lastName: true },
      },
      devices: {
        orderBy: [{ isPrimary: "desc" }, { installedAt: "asc" }],
        include: {
          sim: {
            select: {
              id: true,
              iccid: true,
              phoneNumber: true,
              carrier: true,
              apn: true,
              dataPlanMb: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    name: a.name,
    plate: a.plate,
    vin: a.vin,
    make: a.make,
    model: a.model,
    year: a.year,
    vehicleType: a.vehicleType as AdminAssetVehicleType,
    mobilityType: a.mobilityType as "MOBILE" | "FIXED",
    initialOdometerKm: a.initialOdometerKm,
    status: a.status as AdminAssetStatus,
    account: a.account,
    group: a.group,
    currentDriver: a.currentDriver,
    devices: a.devices.map((d) => ({
      id: d.id,
      imei: d.imei,
      serialNumber: d.serialNumber,
      vendor: d.vendor,
      model: d.model,
      firmwareVersion: d.firmwareVersion,
      status: d.status,
      isPrimary: d.isPrimary,
      lastSeenAt: d.lastSeenAt,
      installedAt: d.installedAt,
      sim: d.sim,
    })),
  };
}
