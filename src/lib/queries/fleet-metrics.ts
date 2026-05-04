// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
// ═══════════════════════════════════════════════════════════════
//  fleet-metrics.ts · single source of truth para KPIs de flota
//  ─────────────────────────────────────────────────────────────
//  Lote 2A · módulo unificado de métricas agregadas de flota.
//
//  PROBLEMA QUE RESUELVE
//  ─────────────────────────────────────────────────────────────
//  Pre-L2 cada pantalla calculaba sus KPIs a su manera:
//
//    Sidebar       · `badge: 7` HARDCODED (Sidebar.tsx)
//    Dashboard     · safety.ts · alarmas SEGURIDAD · sin accountId
//    Torre         · torre.ts · alarmas todos domains · con accountId
//    Catálogos     · assets.ts · cuenta Asset.status denormalizado
//    Boletín       · queries inline · sin accountId (cross-tenant leak)
//    Mapa          · client-side desde el replay (caso especial)
//
//  Resultado · "120 / 6 / 7 / 0 / 204" del mismo concepto en
//  pantallas distintas. Bug B6 a nivel código.
//
//  CÓMO LO RESUELVE
//  ─────────────────────────────────────────────────────────────
//  Toda función expuesta acá:
//   1. Acepta `FleetScope` con `accountId: string | null`
//      · null  → cross-tenant (SA/MA · ven todo)
//      · "..." → forzar a esa cuenta (CA/OP)
//      · NEVER_MATCHING_ACCOUNT → resultado vacío
//   2. Deriva estado de LivePosition con `deriveAssetState()` ·
//      NUNCA lee `Asset.status` excepto para detectar MAINTENANCE
//      (que sigue siendo un override manual del catálogo).
//   3. Tiene tipos de retorno explícitos · no `any`, no inferido.
//
//  CONSUMERS EN L2B (siguiente lote · NO en este)
//  ─────────────────────────────────────────────────────────────
//  Estos lugares deben migrar a las funciones de este módulo:
//
//    [1] Sidebar.tsx              · reemplaza badge: 7
//    [2] /seguridad/dashboard     · reemplaza getSafetyKpis()
//    [3] /seguridad/alarmas       · ya usa alarms.ts · revisar consistencia
//    [4] /seguimiento/torre       · revisar si convive con torre.ts
//    [5] /direccion/vista         · agregar KPI strip
//    [6] /direccion/boletin/[]    · reemplazar queries inline
//    [7] /catalogos/vehiculos     · reemplazar getAssetStatusCounts()
//    [8] /seguimiento/mapa        · queda como está · usa replay client-side
//
//  PERFORMANCE
//  ─────────────────────────────────────────────────────────────
//  getFleetStatusDistribution carga todos los assets del scope con
//  su LivePosition. Para el demo (120 assets) y MVP (~10k) es
//  trivial. A escala 100k+ requiere una de:
//   · Materialized view refrescado por el ingester
//   · Campo `derivedStatus` denormalizado mantenido por trigger
//   · Cache en Redis/memoria con TTL corto
//  Está documentado en ADR-010.
// ═══════════════════════════════════════════════════════════════

import type { AlarmDomain, AssetStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { deriveAssetState } from "@/lib/asset-status";
import { NEVER_MATCHING_ACCOUNT } from "@/lib/queries/tenant-scope";

// ───────────────────────────────────────────────────────────────
//  Tipos públicos
// ───────────────────────────────────────────────────────────────

/**
 * Scope multi-tenant para todas las queries del módulo.
 * Convención · usar `resolveAccountScope()` desde la página y
 * pasar el resultado tal cual.
 *
 * @see src/lib/queries/tenant-scope.ts
 */
export interface FleetScope {
  /**
   *  - `null`                      · cross-tenant (SA/MA sin filtro)
   *  - `string` (cuid)             · forzar a esa cuenta
   *  - `NEVER_MATCHING_ACCOUNT`    · sentinel · query devuelve vacío
   */
  accountId: string | null;
}

/**
 * Período de tiempo cerrado [from, to). Las queries que reciben
 * período tratan `from` como inclusive y `to` como exclusive ·
 * convención estándar para evitar bugs de medianoche.
 */
export interface FleetPeriod {
  from: Date;
  to: Date;
}

/**
 * Distribución de status de la flota · suma siempre = total.
 * MAINTENANCE viene de Asset.status (override manual desde catálogo);
 * el resto se deriva de LivePosition vía `deriveAssetState`.
 */
export interface FleetStatusDistribution {
  MOVING: number;
  IDLE: number;
  STOPPED: number;
  OFFLINE: number;
  MAINTENANCE: number;
  total: number;
}

/**
 * Resumen consolidado · útil para KPI strips que necesitan varios
 * datos en una sola llamada server-side. Las funciones internas se
 * paralelizan vía `Promise.all`.
 */
export interface FleetSummary {
  status: FleetStatusDistribution;
  /** Vehículos con ignition=true · MOVING + IDLE · "operando ahora" */
  vehiclesWithIgnitionOn: number;
  /** Vehículos comunicando · MOVING + IDLE + STOPPED · "online" */
  vehiclesOnline: number;
  /** Conteo de alarmas con status=OPEN del scope. */
  openAlarmsCount: number;
  /**
   *  Conductores con al menos un trip en el período.
   *  Solo se calcula si se pasa `period` en options. Si no, undefined.
   */
  driversWithActivity?: number;
}

// ───────────────────────────────────────────────────────────────
//  Helper interno · construir el WHERE de Asset por scope
// ───────────────────────────────────────────────────────────────

/**
 * Devuelve el `where` de Prisma para Asset filtrado por scope.
 * - null              → {} (sin filtro · cross-tenant)
 * - NEVER_MATCHING    → { id: NEVER_MATCHING_ACCOUNT } (vacío garantizado)
 * - string            → { accountId }
 */
function assetWhereForScope(
  scope: FleetScope,
): Prisma.AssetWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    // Sentinel · garantiza resultado vacío sin tirar la query.
    // Usamos id = sentinel · ningún cuid real va a matchear.
    return { id: NEVER_MATCHING_ACCOUNT };
  }
  if (scope.accountId === null) {
    return {};
  }
  return { accountId: scope.accountId };
}

/**
 * Idem para Alarm · el accountId es directo (Alarm tiene FK propia).
 */
function alarmWhereForScope(
  scope: FleetScope,
): Prisma.AlarmWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    return { id: NEVER_MATCHING_ACCOUNT };
  }
  if (scope.accountId === null) {
    return {};
  }
  return { accountId: scope.accountId };
}

/**
 * Idem para AssetDriverDay.
 */
function driverDayWhereForScope(
  scope: FleetScope,
): Prisma.AssetDriverDayWhereInput {
  if (scope.accountId === NEVER_MATCHING_ACCOUNT) {
    return { id: NEVER_MATCHING_ACCOUNT };
  }
  if (scope.accountId === null) {
    return {};
  }
  return { accountId: scope.accountId };
}

// ═══════════════════════════════════════════════════════════════
//  1. Distribución de status · CORE
//  ─────────────────────────────────────────────────────────────
//  Reemplaza · src/lib/queries/assets.ts::getAssetStatusCounts
//
//  Diferencia clave · esa función lee `Asset.status` denormalizado.
//  Esta deriva de LivePosition · el único campo de Asset que se
//  consulta es `status` para detectar MAINTENANCE (override manual).
// ═══════════════════════════════════════════════════════════════

export async function getFleetStatusDistribution(
  scope: FleetScope,
): Promise<FleetStatusDistribution> {
  const where = assetWhereForScope(scope);

  // Pull todos los assets del scope con su livePosition embebida.
  // Para 120-10k assets · 1 round trip a Postgres · trivial.
  // Para 100k+ · ver nota de performance al inicio del archivo.
  const assets = await db.asset.findMany({
    where,
    select: {
      // status solo se usa para detectar MAINTENANCE
      status: true,
      livePosition: {
        select: {
          updatedAt: true,
          speedKmh: true,
          ignition: true,
        },
      },
    },
  });

  const out: FleetStatusDistribution = {
    MOVING: 0,
    IDLE: 0,
    STOPPED: 0,
    OFFLINE: 0,
    MAINTENANCE: 0,
    total: assets.length,
  };

  const now = new Date();

  for (const a of assets) {
    // MAINTENANCE es override manual desde el catálogo · respetar
    // por encima de cualquier deriva. El vehículo puede estar
    // moviéndose físicamente pero marcado como en mantenimiento
    // (taller probándolo) y la UI debe reflejar el override.
    if (a.status === "MAINTENANCE") {
      out.MAINTENANCE++;
      continue;
    }

    const derived = deriveAssetState(a.livePosition ?? null, now);
    out[derived]++;
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════
//  2. Vehículos con ignition=true · MOVING + IDLE
//  ─────────────────────────────────────────────────────────────
//  "Operando ahora mismo" · motor encendido. Excluye STOPPED
//  (apagado), OFFLINE (sin señal), MAINTENANCE.
// ═══════════════════════════════════════════════════════════════

export async function getFleetVehiclesWithIgnitionOn(
  scope: FleetScope,
): Promise<number> {
  const dist = await getFleetStatusDistribution(scope);
  return dist.MOVING + dist.IDLE;
}

// ═══════════════════════════════════════════════════════════════
//  3. Vehículos online · MOVING + IDLE + STOPPED
//  ─────────────────────────────────────────────────────────────
//  "Comunicando" · todo menos OFFLINE y MAINTENANCE. Útil para
//  el KPI "comunicando vs sin señal" del Mapa o Torre.
// ═══════════════════════════════════════════════════════════════

export async function getFleetVehiclesOnline(
  scope: FleetScope,
): Promise<number> {
  const dist = await getFleetStatusDistribution(scope);
  return dist.MOVING + dist.IDLE + dist.STOPPED;
}

// ═══════════════════════════════════════════════════════════════
//  4. Alarmas abiertas · count
//  ─────────────────────────────────────────────────────────────
//  Reemplaza varios sites:
//   · Sidebar.tsx · `badge: 7` hardcoded
//   · safety.ts::getSafetyKpis · contaba sin accountId
//   · Boletín · contaba global sin scope
//
//  IMPORTANTE · sin `domain` filtra a TODAS (CONDUCCION + SEGURIDAD).
//  El sidebar muestra el total. Cada módulo (Conducción, Seguridad)
//  pasa su domain explícito.
// ═══════════════════════════════════════════════════════════════

export interface OpenAlarmsCountOptions {
  /** Si se pasa, filtra a ese domain. Si no, suma todos. */
  domain?: AlarmDomain;
}

export async function getFleetOpenAlarmsCount(
  scope: FleetScope,
  options: OpenAlarmsCountOptions = {},
): Promise<number> {
  const where: Prisma.AlarmWhereInput = {
    ...alarmWhereForScope(scope),
    status: "OPEN",
    ...(options.domain ? { domain: options.domain } : {}),
  };

  return db.alarm.count({ where });
}

// ═══════════════════════════════════════════════════════════════
//  5. Conductores con actividad en el período
//  ─────────────────────────────────────────────────────────────
//  Cuenta personIds distintos con al menos un AssetDriverDay en
//  el rango. Usa AssetDriverDay (pre-agregado) · NO toca Trip ni
//  Position · query barata.
//
//  No mide "conductores activos hoy mismo" · para eso habría que
//  ir a Trip con `endedAt > now - 1h` o similar. Esa función es
//  futura · distinta semántica.
// ═══════════════════════════════════════════════════════════════

export async function getFleetDriversWithActivity(
  scope: FleetScope,
  period: FleetPeriod,
): Promise<number> {
  const where = {
    ...(scope.accountId === NEVER_MATCHING_ACCOUNT
      ? { id: NEVER_MATCHING_ACCOUNT }
      : scope.accountId
        ? { accountId: scope.accountId }
        : {}),
    day: {
      gte: period.from,
      lt: period.to,
    },
  };

  // distinct sobre personId · Prisma no tiene "countDistinct" nativo
  // así que groupBy + length. Para volúmenes del demo (9.6k rows) ·
  // trivial. A escala vamos a un raw query.
  const grouped = await db.assetDriverDay.groupBy({
    by: ["personId"],
    where,
  });

  return grouped.length;
}

// ═══════════════════════════════════════════════════════════════
//  6. Total de assets en el scope
//  ─────────────────────────────────────────────────────────────
//  Reemplaza los `db.asset.count()` directos sin scope (Boletín,
//  debug page, etc.) que cuentan cross-tenant cuando no deberían.
// ═══════════════════════════════════════════════════════════════

export async function getFleetTotalAssets(
  scope: FleetScope,
): Promise<number> {
  return db.asset.count({ where: assetWhereForScope(scope) });
}

// ═══════════════════════════════════════════════════════════════
//  7. Resumen consolidado
//  ─────────────────────────────────────────────────────────────
//  Útil para consumers que necesitan varios KPIs · paraleliza
//  internamente. Si solo necesitás un KPI, llamá la función
//  individual · no traigas todo.
// ═══════════════════════════════════════════════════════════════

export interface FleetSummaryOptions {
  /** Si se pasa, calcula `driversWithActivity`. */
  period?: FleetPeriod;
  /** Filtra alarmas a un domain específico. Default · todas. */
  alarmDomain?: AlarmDomain;
}

export async function getFleetSummary(
  scope: FleetScope,
  options: FleetSummaryOptions = {},
): Promise<FleetSummary> {
  const [status, openAlarmsCount, driversWithActivity] = await Promise.all([
    getFleetStatusDistribution(scope),
    getFleetOpenAlarmsCount(scope, { domain: options.alarmDomain }),
    options.period
      ? getFleetDriversWithActivity(scope, options.period)
      : Promise.resolve(undefined),
  ]);

  return {
    status,
    vehiclesWithIgnitionOn: status.MOVING + status.IDLE,
    vehiclesOnline: status.MOVING + status.IDLE + status.STOPPED,
    openAlarmsCount,
    driversWithActivity,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Re-exports útiles para consumers
// ═══════════════════════════════════════════════════════════════

export type { AssetStatus, AlarmDomain };
