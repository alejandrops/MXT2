// ═══════════════════════════════════════════════════════════════
//  Sims queries · backoffice (H3)
//  ─────────────────────────────────────────────────────────────
//  Catálogo de SIM cards. Cada SIM puede estar:
//   · STOCK     · no asignada a ningún device
//   · ACTIVE    · operando dentro de un device
//   · SUSPENDED · pausada por el carrier
//   · CANCELLED · dada de baja
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

export type Carrier = "MOVISTAR" | "CLARO" | "PERSONAL" | "ENTEL" | "OTHER";

export type SimStatus = "STOCK" | "ACTIVE" | "SUSPENDED" | "CANCELLED";

export interface SimListRow {
  id: string;
  iccid: string;
  phoneNumber: string | null;
  carrier: Carrier;
  apn: string;
  dataPlanMb: number;
  status: SimStatus;
  activatedAt: Date | null;
  createdAt: Date;
  device: {
    id: string;
    imei: string;
    assetName: string | null;
    accountName: string | null;
  } | null;
}

export interface SimListResult {
  rows: SimListRow[];
  total: number;
}

export async function listSims(opts: {
  search?: string | null;
  carrier?: Carrier | null;
  status?: SimStatus | null;
} = {}): Promise<SimListResult> {
  const where: any = {};
  if (opts.carrier) where.carrier = opts.carrier;
  if (opts.status) where.status = opts.status;
  if (opts.search) {
    where.OR = [
      { iccid: { contains: opts.search } },
      { phoneNumber: { contains: opts.search } },
      { apn: { contains: opts.search } },
    ];
  }

  const [total, sims] = await Promise.all([
    db.sim.count({ where }),
    db.sim.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { carrier: "asc" },
        { iccid: "asc" },
      ],
      select: {
        id: true,
        iccid: true,
        phoneNumber: true,
        carrier: true,
        apn: true,
        dataPlanMb: true,
        status: true,
        activatedAt: true,
        createdAt: true,
        device: {
          select: {
            id: true,
            imei: true,
            asset: {
              select: {
                name: true,
                account: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const rows: SimListRow[] = (sims as any[]).map((s) => ({
    id: s.id,
    iccid: s.iccid,
    phoneNumber: s.phoneNumber,
    carrier: s.carrier as Carrier,
    apn: s.apn,
    dataPlanMb: s.dataPlanMb,
    status: s.status as SimStatus,
    activatedAt: s.activatedAt,
    createdAt: s.createdAt,
    device: s.device
      ? {
          id: s.device.id,
          imei: s.device.imei,
          assetName: s.device.asset?.name ?? null,
          accountName: s.device.asset?.account?.name ?? null,
        }
      : null,
  }));

  return { rows, total };
}

export interface SimCounts {
  total: number;
  stock: number;
  active: number;
  suspended: number;
  cancelled: number;
}

export async function getSimCounts(): Promise<SimCounts> {
  const [total, byStatus] = await Promise.all([
    db.sim.count(),
    db.sim.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const map: Record<string, number> = {
    STOCK: 0,
    ACTIVE: 0,
    SUSPENDED: 0,
    CANCELLED: 0,
  };
  for (const r of byStatus as { status: string; _count: { _all: number } }[]) {
    map[r.status] = r._count._all;
  }

  return {
    total,
    stock: map.STOCK ?? 0,
    active: map.ACTIVE ?? 0,
    suspended: map.SUSPENDED ?? 0,
    cancelled: map.CANCELLED ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers para drawer
// ═══════════════════════════════════════════════════════════════

export async function getSimForEdit(simId: string): Promise<{
  id: string;
  iccid: string;
  phoneNumber: string | null;
  imsi: string | null;
  carrier: Carrier;
  apn: string;
  dataPlanMb: number;
  status: SimStatus;
  deviceId: string | null;
  deviceImei: string | null;
  assetName: string | null;
  accountName: string | null;
} | null> {
  const s = await db.sim.findUnique({
    where: { id: simId },
    include: {
      device: {
        include: {
          asset: {
            include: { account: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    iccid: s.iccid,
    phoneNumber: s.phoneNumber,
    imsi: s.imsi,
    carrier: s.carrier as Carrier,
    apn: s.apn,
    dataPlanMb: s.dataPlanMb,
    status: s.status as SimStatus,
    deviceId: s.device?.id ?? null,
    deviceImei: s.device?.imei ?? null,
    assetName: s.device?.asset?.name ?? null,
    accountName: s.device?.asset?.account?.name ?? null,
  };
}

/**
 * Lista de devices disponibles para asignar una SIM:
 *  - Devices SIN sim asignada (simId == null)
 *  - O el device que ya tiene esta SIM (para edit, no perderlo)
 *
 * Resultado ordenado por account · name para que la lista sea
 * navegable cuando hay muchos devices.
 */
export async function listDevicesForSimAssign(opts: {
  /** Si está editando, incluir el device actual aunque tenga SIM */
  currentSimId?: string | null;
} = {}): Promise<
  {
    id: string;
    imei: string;
    model: string;
    assetName: string | null;
    accountName: string | null;
  }[]
> {
  const where: any = {
    OR: [{ simId: null }],
  };
  if (opts.currentSimId) {
    where.OR.push({ simId: opts.currentSimId });
  }

  const devices = await db.device.findMany({
    where,
    select: {
      id: true,
      imei: true,
      model: true,
      asset: {
        select: {
          name: true,
          account: { select: { name: true } },
        },
      },
    },
    orderBy: [{ imei: "asc" }],
  });

  return devices.map((d) => ({
    id: d.id,
    imei: d.imei,
    model: d.model,
    assetName: d.asset?.name ?? null,
    accountName: d.asset?.account?.name ?? null,
  }));
}
