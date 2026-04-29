import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  /api/search?q=...
//  ─────────────────────────────────────────────────────────────
//  Búsqueda global usada por Cmd+K. Devuelve hasta 5 resultados
//  por tipo (vehículos, conductores, grupos) que matchean el
//  término ingresado.
//
//  Convenciones:
//    · case-insensitive (SQLite usa LIKE para esto)
//    · busca en múltiples campos (name, plate, full name, dni)
//    · limit 5 por tipo · si hay más, el frontend muestra "+N más"
//    · query mínima 2 caracteres (controlado en el frontend)
//
//  Las pantallas del sidebar van hardcodeadas en el frontend ·
//  no necesitan API call.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export interface SearchResult {
  vehicles: VehicleHit[];
  drivers: DriverHit[];
  groups: GroupHit[];
}

export interface VehicleHit {
  id: string;
  name: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  groupName: string | null;
}

export interface DriverHit {
  id: string;
  fullName: string;
  document: string | null;
}

export interface GroupHit {
  id: string;
  name: string;
  assetCount: number;
}

const LIMIT_PER_TYPE = 5;

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({
      vehicles: [],
      drivers: [],
      groups: [],
    } satisfies SearchResult);
  }

  // SQLite no soporta `mode: "insensitive"` · usamos LIKE con
  // toLowerCase. El fielding directo es suficientemente rápido
  // para flotas de hasta ~10k objetos.
  const [vehicles, drivers, groups] = await Promise.all([
    searchVehicles(q),
    searchDrivers(q),
    searchGroups(q),
  ]);

  return NextResponse.json({
    vehicles,
    drivers,
    groups,
  } satisfies SearchResult);
}

async function searchVehicles(q: string): Promise<VehicleHit[]> {
  const rows = await db.asset.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { plate: { contains: q } },
        { vin: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      plate: true,
      make: true,
      model: true,
      group: { select: { name: true } },
    },
    take: LIMIT_PER_TYPE,
    orderBy: { name: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    plate: r.plate,
    make: r.make,
    model: r.model,
    groupName: r.group?.name ?? null,
  }));
}

async function searchDrivers(q: string): Promise<DriverHit[]> {
  const rows = await db.person.findMany({
    where: {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { document: { contains: q } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      document: true,
    },
    take: LIMIT_PER_TYPE,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    fullName: `${r.firstName} ${r.lastName}`.trim(),
    document: r.document,
  }));
}

async function searchGroups(q: string): Promise<GroupHit[]> {
  const rows = await db.group.findMany({
    where: { name: { contains: q } },
    select: {
      id: true,
      name: true,
      _count: { select: { assets: true } },
    },
    take: LIMIT_PER_TYPE,
    orderBy: { name: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    assetCount: r._count.assets,
  }));
}
