# ADR-010 · Fleet metrics · módulo unificado de KPIs de flota

**Status:** Accepted
**Date:** 2026-05-02
**Lote:** L2A
**Decision-makers:** Alejandro (PO), Claude (orquestador de desarrollo)

## Contexto

Antes del L2 cada pantalla calculaba sus KPIs de flota de manera independiente:

| Consumer | Cómo cuenta hoy | Filtra accountId | Deriva de LivePosition |
|---|---|---|---|
| `Sidebar.tsx:109` | `badge: 7` HARDCODED | n/a | n/a |
| `safety.ts::getSafetyKpis` | `db.alarm.count({domain:SEGURIDAD})` | NO | n/a |
| `torre.ts::getAlarmQueueKpis` | `db.alarm.count` ambos domains | SÍ | n/a |
| `assets.ts::getAssetStatusCounts` | `db.asset.groupBy({status})` | SÍ | NO · denormalizado |
| `boletin/[period]/page.tsx` | Queries inline | NO | n/a |
| `FleetTrackingClient.tsx` | Client-side desde el replay | n/a | parcial |

Resultado · la auditoría reportó "120 / 6 / 7 / 0 / 204" del mismo concepto en pantallas distintas (bug **B6**). L0 estabilizó la DB sincronizando `Asset.status` con `LivePosition` vía `refresh-live-positions.ts`, pero la inconsistencia sigue latente: si el cron no corre (o el ingester no actualiza `Asset.status`), las cifras divergen otra vez.

## Decisión

Crear `src/lib/queries/fleet-metrics.ts` como **single source of truth** para métricas agregadas de flota. Toda función expuesta:

1. **Acepta `FleetScope`** con `accountId: string | null`, alineado con `resolveAccountScope()`. El `null` significa cross-tenant (SA/MA), y `NEVER_MATCHING_ACCOUNT` es un sentinel que garantiza vacío. Esto cierra el cross-tenant leak de Boletín y Dashboard.
2. **Deriva estado desde LivePosition** vía `deriveAssetState()`. Solo lee `Asset.status` para detectar el override `MAINTENANCE` (que es manual desde el catálogo). Esto cierra la divergencia denormalizada/derivada de Catálogos.
3. **Tipa explícitamente** input y output. Usa `Prisma.XxxWhereInput` (patrón ya presente en `alarms.ts`).
4. **No reemplaza queries existentes en este lote.** L2A solo crea el módulo + script de validación. L2B migrará los 7 consumers (el Mapa queda como caso especial).

API:

```ts
type FleetScope = { accountId: string | null }
type FleetPeriod = { from: Date; to: Date }

getFleetStatusDistribution(scope) → { MOVING, IDLE, STOPPED, OFFLINE, MAINTENANCE, total }
getFleetVehiclesWithIgnitionOn(scope) → number   // MOVING + IDLE
getFleetVehiclesOnline(scope) → number           // MOVING + IDLE + STOPPED
getFleetOpenAlarmsCount(scope, { domain? }) → number
getFleetDriversWithActivity(scope, period) → number
getFleetTotalAssets(scope) → number
getFleetSummary(scope, { period?, alarmDomain? }) → FleetSummary
```

## Consecuencias

### Positivas

- **Bug B6 resuelto a nivel código** (no solo a nivel datos como L0). Los consumers que migren en L2B van a leer del mismo módulo · no puede haber divergencia.
- **Cross-tenant leak resuelto** en Boletín y Dashboard al exigir `FleetScope` explícito.
- **Tests automatizables** vía el script `validate-fleet-metrics.ts` que compara la lógica nueva con las queries actuales y reporta diffs.
- **El override MAINTENANCE manual sigue funcionando** · separado del estado derivado.

### Negativas

- **`getFleetStatusDistribution` carga todos los assets del scope con su `LivePosition` embebida.** Para 120 assets (demo) y MVP (~10k) es trivial. A escala 100k+ requiere una de:
  - Materialized view refrescado por el ingester
  - Campo `derivedStatus` denormalizado mantenido por trigger SQL
  - Cache en Redis o memoria con TTL corto
- Convive con las queries viejas hasta L2B · duplicación temporal. Mitigación · L2B migra y elimina las viejas.
- Mapa (`FleetTrackingClient.tsx`) **no migra**. Su KPI es client-side desde el replay (semántica distinta · "moviéndose en este momento del replay" ≠ "moviéndose ahora mismo en realidad"). Documentar como caso especial · no es deuda.

### Nulas

- No requiere cambio de schema. Todo trabajo es en código de aplicación.
- No afecta el ingester ni los seeds.

## Plan de migración (L2B · próximo lote)

Orden propuesto, de más simple a más complejo:

1. **Sidebar.tsx** · reemplazar `badge: 7` por `getFleetOpenAlarmsCount(scope)` server-side (requiere convertir el cargado del badge a Server Component o pasar via prop · ver lote)
2. **Catálogos vehículos** · `getAssetStatusCounts` → `getFleetStatusDistribution`
3. **Dashboard Seguridad** · `getSafetyKpis` → composición de `fleet-metrics` con `domain: "SEGURIDAD"`
4. **Boletín** · queries inline → `getFleetSummary` con accountId del scope
5. **Vista ejecutiva** · agregar KPI strip
6. **Torre** · evaluar si convive con `torre.ts` o se reemplaza · en principio convive porque Torre tiene KPIs propios (`bySeverity`, `attending`, `closedToday`) que no son flota-genéricos

## Validación

```bash
npx tsx prisma/validate-fleet-metrics.ts          # tabla resumen
npx tsx prisma/validate-fleet-metrics.ts --verbose # detalle por account
npx tsx prisma/validate-fleet-metrics.ts --json    # output máquina
```

El script reporta divergencias entre la lógica derivada y las queries actuales. Si reporta `ERROR`, es un bug latente que L2B va a curar.

## Referencias

- `src/lib/asset-status.ts` (helper L0 · `deriveAssetState`)
- `src/lib/queries/tenant-scope.ts` (`resolveAccountScope`, `NEVER_MATCHING_ACCOUNT`)
- HANDOFF.md `BLOQUE 2 · L2 · Layer unificado de queries de flota`
- Auditoría · bug B6 (datos contradictorios entre módulos)
