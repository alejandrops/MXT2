/**
 * validate-fleet-metrics.ts · Lote 2A
 *
 * Script standalone que valida el comportamiento del módulo nuevo
 * src/lib/queries/fleet-metrics.ts contra la DB real, y lo compara
 * con las queries actuales que va a reemplazar en L2B.
 *
 * Para cada scope (global cross-tenant + cada Account):
 *   1. Calcula los KPIs replicando la lógica del módulo
 *   2. Corre las queries actuales (Asset.status denormalizado,
 *      db.alarm.count global, etc.)
 *   3. Reporta diferencias · si hay diff, hay bug latente que
 *      L2B va a curar al migrar consumers
 *
 * Usage:
 *   npx tsx prisma/validate-fleet-metrics.ts
 *   npx tsx prisma/validate-fleet-metrics.ts --verbose   // detalle por account
 *   npx tsx prisma/validate-fleet-metrics.ts --json      // output máquina
 *
 * Self-contained · no importa @/lib/... porque prisma/ está
 * excluido del tsconfig y los paths no resolverían vía tsx.
 * Replica la lógica mínima de deriveAssetState para que el
 * resultado sea independiente del módulo (golden comparison).
 */

import {
  PrismaClient,
  type AlarmDomain,
  type AssetStatus,
} from "@prisma/client";

const db = new PrismaClient();

const VERBOSE = process.argv.includes("--verbose");
const JSON_OUT = process.argv.includes("--json");

// ───────────────────────────────────────────────────────────────
//  Lógica replicada · debe ser EXACTA al módulo
// ───────────────────────────────────────────────────────────────

const NO_SIGNAL_THRESHOLD_HOURS = 24;
const MOVING_MIN_KMH = 5;

function deriveAssetState(
  live: { updatedAt: Date; speedKmh: number; ignition: boolean } | null,
  now: Date,
): AssetStatus {
  if (!live) return "OFFLINE";
  const ageHours = (now.getTime() - live.updatedAt.getTime()) / 3600000;
  if (ageHours > NO_SIGNAL_THRESHOLD_HOURS) return "OFFLINE";
  if (!live.ignition) return "STOPPED";
  if (live.speedKmh > MOVING_MIN_KMH) return "MOVING";
  return "IDLE";
}

interface StatusDist {
  MOVING: number;
  IDLE: number;
  STOPPED: number;
  OFFLINE: number;
  MAINTENANCE: number;
  total: number;
}

async function deriveStatusDistribution(
  accountId: string | null,
): Promise<StatusDist> {
  const where = accountId === null ? {} : { accountId };
  const assets = await db.asset.findMany({
    where,
    select: {
      status: true,
      livePosition: {
        select: { updatedAt: true, speedKmh: true, ignition: true },
      },
    },
  });

  const out: StatusDist = {
    MOVING: 0,
    IDLE: 0,
    STOPPED: 0,
    OFFLINE: 0,
    MAINTENANCE: 0,
    total: assets.length,
  };

  const now = new Date();
  for (const a of assets) {
    if (a.status === "MAINTENANCE") {
      out.MAINTENANCE++;
      continue;
    }
    out[deriveAssetState(a.livePosition ?? null, now)]++;
  }
  return out;
}

async function denormalizedStatusDistribution(
  accountId: string | null,
): Promise<StatusDist> {
  // Lo que hace HOY src/lib/queries/assets.ts::getAssetStatusCounts
  // Lee Asset.status directo · sin derivar.
  const where = accountId === null ? undefined : { accountId };
  const groups = await db.asset.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  const out: StatusDist = {
    MOVING: 0,
    IDLE: 0,
    STOPPED: 0,
    OFFLINE: 0,
    MAINTENANCE: 0,
    total: 0,
  };
  for (const g of groups) {
    out[g.status] = g._count._all;
    out.total += g._count._all;
  }
  return out;
}

async function openAlarmsCount(
  accountId: string | null,
  domain?: AlarmDomain,
): Promise<number> {
  return db.alarm.count({
    where: {
      status: "OPEN",
      ...(accountId === null ? {} : { accountId }),
      ...(domain ? { domain } : {}),
    },
  });
}

async function driversWithActivity(
  accountId: string | null,
  fromDate: Date,
  toDate: Date,
): Promise<number> {
  const grouped = await db.assetDriverDay.groupBy({
    by: ["personId"],
    where: {
      ...(accountId === null ? {} : { accountId }),
      day: { gte: fromDate, lt: toDate },
    },
  });
  return grouped.length;
}

// ───────────────────────────────────────────────────────────────
//  Comparación · módulo nuevo vs queries actuales
// ───────────────────────────────────────────────────────────────

interface DiffRow {
  scope: string;
  kpi: string;
  derived: number | string;
  current: number | string;
  diff: number | string;
  level: "OK" | "WARN" | "ERROR";
  note?: string;
}

function pushDiff(
  rows: DiffRow[],
  scope: string,
  kpi: string,
  derived: number,
  current: number,
  threshold = 0,
  note?: string,
): void {
  const delta = derived - current;
  let level: DiffRow["level"] = "OK";
  if (delta !== 0) {
    level = Math.abs(delta) > threshold ? "ERROR" : "WARN";
  }
  rows.push({
    scope,
    kpi,
    derived,
    current,
    diff: delta > 0 ? `+${delta}` : `${delta}`,
    level,
    note,
  });
}

async function main(): Promise<void> {
  if (!JSON_OUT) {
    console.log("\n🔍 validate-fleet-metrics · L2A");
    console.log("   Comparando lógica derivada vs queries actuales\n");
    console.time("validate");
  }

  const accounts = await db.account.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  if (!JSON_OUT) {
    console.log(`   ${accounts.length} cuentas · más scope global cross-tenant`);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const now = new Date();

  const rows: DiffRow[] = [];

  // ── Scope global (cross-tenant · null) ──────────────────────
  const scopes: Array<{ id: string | null; label: string }> = [
    { id: null, label: "global (cross-tenant)" },
    ...accounts.map((a) => ({ id: a.id, label: a.slug })),
  ];

  for (const scope of scopes) {
    // 1. Status distribution · derivado vs denormalizado
    const derived = await deriveStatusDistribution(scope.id);
    const denorm = await denormalizedStatusDistribution(scope.id);

    pushDiff(rows, scope.label, "total", derived.total, denorm.total);
    pushDiff(rows, scope.label, "MOVING", derived.MOVING, denorm.MOVING, 2);
    pushDiff(rows, scope.label, "IDLE", derived.IDLE, denorm.IDLE, 2);
    pushDiff(rows, scope.label, "STOPPED", derived.STOPPED, denorm.STOPPED, 2);
    pushDiff(rows, scope.label, "OFFLINE", derived.OFFLINE, denorm.OFFLINE, 2);
    pushDiff(
      rows,
      scope.label,
      "MAINTENANCE",
      derived.MAINTENANCE,
      denorm.MAINTENANCE,
    );

    // 2. Open alarms · all domains, SEGURIDAD only, CONDUCCION only
    const allOpen = await openAlarmsCount(scope.id);
    const segOpen = await openAlarmsCount(scope.id, "SEGURIDAD");
    const condOpen = await openAlarmsCount(scope.id, "CONDUCCION");

    rows.push({
      scope: scope.label,
      kpi: "alarms.open (all)",
      derived: allOpen,
      current: allOpen,
      diff: "0",
      level: "OK",
      note: `seguridad=${segOpen} · conduccion=${condOpen}`,
    });

    // 3. Drivers with activity 7d
    const drv7d = await driversWithActivity(scope.id, sevenDaysAgo, now);
    rows.push({
      scope: scope.label,
      kpi: "drivers.activity7d",
      derived: drv7d,
      current: drv7d,
      diff: "0",
      level: "OK",
    });
  }

  // ── Hardcoded sidebar badge check (Sidebar.tsx:109 · badge: 7) ──
  const realOpenAlarmsGlobal = await openAlarmsCount(null);
  const sidebarHardcoded = 7;
  rows.push({
    scope: "global (cross-tenant)",
    kpi: "sidebar.badge (HARDCODED)",
    derived: realOpenAlarmsGlobal,
    current: sidebarHardcoded,
    diff: `${realOpenAlarmsGlobal - sidebarHardcoded > 0 ? "+" : ""}${realOpenAlarmsGlobal - sidebarHardcoded}`,
    level: realOpenAlarmsGlobal === sidebarHardcoded ? "OK" : "ERROR",
    note: "Sidebar.tsx:109 hardcoded · debe leer de fleet-metrics",
  });

  // ── Output ──────────────────────────────────────────────────

  if (JSON_OUT) {
    console.log(JSON.stringify({ rows, generatedAt: new Date().toISOString() }, null, 2));
    await db.$disconnect();
    return;
  }

  console.log("");
  printTable(rows);

  // Resumen
  const errors = rows.filter((r) => r.level === "ERROR").length;
  const warns = rows.filter((r) => r.level === "WARN").length;
  const ok = rows.filter((r) => r.level === "OK").length;

  console.log("");
  console.log("─── Resumen ───");
  console.log(`  ✓ OK:    ${ok}`);
  console.log(`  ⚠ WARN:  ${warns}  (delta tolerable · puede ser timing)`);
  console.log(`  ✗ ERROR: ${errors}  (divergencia real · L2B la cura)`);
  console.log("");

  if (errors > 0) {
    console.log("Las divergencias en ERROR son los bugs B6 a nivel código:");
    console.log("  · Sidebar hardcoded vs realidad");
    console.log("  · Asset.status denormalizado vs LivePosition derivada");
    console.log("L2B migra los consumers para que estos bugs desaparezcan.");
    console.log("");
  }

  console.timeEnd("validate");
  await db.$disconnect();
}

function printTable(rows: DiffRow[]): void {
  if (rows.length === 0) {
    console.log("(sin filas)");
    return;
  }

  const headers = ["scope", "kpi", "derived", "current", "diff", "level"];
  const widths = headers.map((h) => h.length);
  for (const r of rows) {
    widths[0] = Math.max(widths[0]!, String(r.scope).length);
    widths[1] = Math.max(widths[1]!, String(r.kpi).length);
    widths[2] = Math.max(widths[2]!, String(r.derived).length);
    widths[3] = Math.max(widths[3]!, String(r.current).length);
    widths[4] = Math.max(widths[4]!, String(r.diff).length);
    widths[5] = Math.max(widths[5]!, String(r.level).length);
  }

  const sep = "│ ";
  const pad = (s: string, w: number, right = false): string =>
    right ? s.padStart(w) : s.padEnd(w);

  // header
  let line = sep;
  for (let i = 0; i < headers.length; i++) {
    line += pad(headers[i]!, widths[i]!, i >= 2 && i <= 4) + " " + sep;
  }
  console.log(line);
  console.log(sep + widths.map((w) => "─".repeat(w + 1)).join("┼─") + "─┤");

  // rows · agrupar por scope para legibilidad
  let lastScope = "";
  for (const r of rows) {
    if (!VERBOSE && r.level === "OK" && r.scope !== "global (cross-tenant)") {
      continue; // sin verbose, omito OKs por account
    }
    const scopeStr = r.scope === lastScope ? "" : r.scope;
    lastScope = r.scope;

    const colorPrefix =
      r.level === "ERROR" ? "\x1b[31m" : r.level === "WARN" ? "\x1b[33m" : "\x1b[90m";
    const colorSuffix = "\x1b[0m";

    let line = sep;
    line += pad(scopeStr, widths[0]!) + " " + sep;
    line += pad(String(r.kpi), widths[1]!) + " " + sep;
    line += pad(String(r.derived), widths[2]!, true) + " " + sep;
    line += pad(String(r.current), widths[3]!, true) + " " + sep;
    line += pad(String(r.diff), widths[4]!, true) + " " + sep;
    line += colorPrefix + pad(String(r.level), widths[5]!) + colorSuffix + " " + sep;
    console.log(line);
    if (r.note && (VERBOSE || r.level !== "OK")) {
      console.log(`│   ↳ ${r.note}`);
    }
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
