# ADR-011 · TypeScript strict cleanup · approach mecánico

**Status:** Accepted
**Date:** 2026-05-02
**Lote:** L1.5a (mecánico) + L1.5b (refactor real · pendiente)
**Decision-makers:** Alejandro (PO), Claude (orquestador de desarrollo)

## Contexto

`next.config.ts` tiene desde hace tiempo:

```ts
typescript: { ignoreBuildErrors: true }
```

con un comentario que reza "Tracking en lote L1 (futuro · TypeScript cleanup)". Esa deuda nunca se atendió. Al correr `npx tsc --noEmit` después de aplicar L0/L1/L2A se descubrieron **119 errores en 34 archivos**. Vercel deploys siguen pasando porque `next build` ignora estos errores, pero el cleanup es necesario porque:

1. Los errores reales se mezclan con los preexistentes · impossible distinguir señal de ruido en lotes futuros.
2. Refactors lentos · el typecheck ya no sirve como red de seguridad.
3. Algunos errores son bugs latentes (cross-tenant leaks, Prisma type drifts).

## Decisión

Atacar los 119 en **dos pasadas** según naturaleza del cambio:

### L1.5a · Mechanical sweep (~100 errores · este lote)

Cambios sin refactor de modelo · cualquier desarrollador con acceso al código puede aplicarlos en linea sin entender el dominio:

| Patrón | Ejemplo | Solución |
|---|---|---|
| CSS modules con `noUncheckedIndexedAccess` | `return styles.statusMoving;` | `return styles.statusMoving!;` |
| Records con default | `byKey.SUPER_ADMIN` | `byKey.SUPER_ADMIN ?? 0` |
| `Record<string,boolean>` para useState | `useState<Record<string,boolean>>({a:true,b:false})` | `useState({a:true,b:false})` (objeto literal) |
| Arrays con bound check probado | `positions[i]` post `for (let i; i<length; i++)` | `positions[i]!` |
| Constantes de Prisma enum dispersas | 4 copias de `["IGNITION_ON", "IGNITION_OFF"]` | Una sola `TELEMETRY_EVENT_TYPES: EventType[]` en `format.ts` |
| `groupBy._count._all` access | `e._count._all` | Cast explícito post-tipo retorno de Prisma 6 |
| `where: { type: { notIn: string[] } }` | objeto inline manual | Cambiar tipo a `Prisma.EventWhereInput` |
| `heading: number \| null` en queries | DB column nullable | `heading: dbHeading ?? 0` (default norte · justificable semántica) |

**Justificación del approach:**

- **Non-null assertion (`!`)** es feo pero correcto donde se sabe que el valor existe (post-guard de length, post-`if (s === "MOVING")`, etc.). El comportamiento runtime no cambia.
- **Default `?? 0`** para `heading` es preferible a propagar `number | null` aguas abajo · evita que ~50 componentes que dibujan markers tengan que manejar null. Heading 0 = norte = razonable como fallback.
- **Cast `as VehicleType`** en `activity.ts` se usa porque el filtro viene del searchParam y ya pasó validación al construirse (no es input arbitrario).
- **Centralizar `TELEMETRY_EVENT_TYPES`** en `format.ts` no solo arregla el tipo sino que elimina duplicación de código (4 lugares declaraban lo mismo).

### L1.5b · Refactor real (~15-20 errores · próximo lote)

Cambios que requieren entender el modelo y propagar:

- **`session.ts`** agregar `phone`, `documentNumber` a `SessionData.user` y `tier` a `SessionData.account` · ya están en el schema Prisma pero no se hidratan al construir la session.
- **3 queries removidas** · `getPersonRelationCounts`, `getGroupRelationCounts`, `getGroupDescendantIds` · sus callers existen y dependen de un shape específico de retorno. Hay que reimplementar las funciones (no es un rename).
- **`TripsClient` / `DaysList` / `TripDetailPanel`** · alguien empezó una migración del modelo "selección por día" a "selección por item" en `TripsClient` pero no propagó a los hijos. Hay que terminar la refactorización.
- **`listGroupsForFilter`** · agregar parámetro `accountId` opcional · hoy no acepta argumentos pero el caller pasa uno.
- **`getAccountsForFilter`** · aceptar `string[] | string | null | undefined` (hoy solo acepta `string | null | undefined`).

## Consecuencias

### Positivas

- Typecheck volverá a ser señal real · cuando aparezca un error nuevo en lotes futuros, será del cambio nuevo, no ruido.
- Cleanup documentado en ADR · futuras decisiones de cuándo aceptar deuda TS tienen referencia.
- Bug B6-relacionado (Prisma enum drift en boletín) cae como efecto colateral.

### Negativas

- ~50 puntos en el código con non-null assertion `!`. Feo pero correcto · cualquier alternativa (typed CSS modules, helpers wrapper) sería más invasiva sin beneficio runtime.
- Convivencia parcial · L1.5a deja ~15 errores en pie · esos quedan como TODO marcado para L1.5b.
- `ignoreBuildErrors: true` se mantiene **hasta cerrar L1.5b**. Una vez que `npx tsc --noEmit` pase limpio, sacar ese flag de `next.config.ts` es tarea separada (L1.5c · 1 línea de cambio).

### Nulas

- No requiere cambio de schema.
- No afecta build de producción · seguía pasando antes con flag, sigue pasando ahora.
- No afecta runtime · cero comportamiento cambia con non-null assertions y `?? defaults`.

## Lista completa de archivos modificados (L1.5a)

26 archivos:

**Core**
- `src/lib/format.ts` (TELEMETRY_EVENT_TYPES centralizado)

**Queries**
- `src/lib/queries/devices.ts`, `sims.ts`, `users.ts` (Records con default)
- `src/lib/queries/tenant-scope.ts` (allowed[0] post-guard)
- `src/lib/queries/tracking.ts` (heading null)
- `src/lib/queries/historicos.ts` (heading null en points)
- `src/lib/queries/asset-day-map.ts` (heading null en lastPosition)
- `src/lib/queries/asset-live-status.ts` (primaryDevice missing en return)
- `src/lib/queries/activity.ts` (vehicleType cast a enum)

**Ingestion**
- `src/lib/ingestion/geo.ts` (decimate con bound check)
- `src/lib/ingestion/trip-detection.ts` (positions[i] post bound check)

**Components**
- `src/components/maxtracker/objeto/DrivenAssetsSection.tsx` (statusClass CSS modules)
- `src/components/maxtracker/objeto/GroupCompositionSection.tsx` (idem)
- `src/components/maxtracker/boletin/BlockF_Seguridad.tsx` (cls undefined en map)
- `src/components/maxtracker/AssetLiveStatus.tsx` (heading guard)
- `src/components/import-csv/csv-parser.ts` (lines[0] post length check)

**Pages**
- `src/app/(product)/objeto/[tipo]/[id]/modules/SecurityBookTab.tsx` (CSS modules + AlarmWhereInput)
- `src/app/(product)/objeto/[tipo]/[id]/modules/ActivityBookTab.tsx` (Prisma where + TELEMETRY)
- `src/app/(product)/direccion/boletin/[period]/page.tsx` (TELEMETRY + _count + sevCount/domCount + VehicleRow)
- `src/app/(product)/configuracion/ConfiguracionClient.tsx` (TabKey → SectionKey alias)

**Admin pages**
- `src/app/admin/conductores/AdminDriverDrawer.tsx` (openSections literal)
- `src/app/admin/conductores/page.tsx` (chip value default)
- `src/app/admin/vehiculos/AdminAssetDrawer.tsx` (openSections literal)
- `src/app/admin/usuarios/UsersTable.tsx` (AVATAR_COLORS index)
- `src/app/admin/usuarios/UserEditDrawer.tsx` (assignableProfiles[0])

## Validación

Después de aplicar:

```bash
npx tsc --noEmit 2>&1 | grep "Found"
```

**Esperado** · "Found ~15 errors in ~7 files" (vs. 119 en 34 antes).

Los errores que queden son los de L1.5b (refactor real).

## Referencias

- `next.config.ts` (`ignoreBuildErrors: true` · línea 9 · removerá L1.5c)
- HANDOFF.md `BLOQUE 1.5 · L1.5 · TypeScript cleanup`
- Output de Alejandro post-L2A · 119 errores categorizados
