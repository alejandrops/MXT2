# ADR-012 · TypeScript drift cleanup · refactor real

**Status:** Accepted
**Date:** 2026-05-02
**Lote:** L1.5b
**Decision-makers:** Alejandro (PO), Claude (orquestador de desarrollo)

## Contexto

L1.5a cerró 101 de 119 errores TS preexistentes con cambios mecánicos (CSS modules, Records con default, arrays con guards). Quedaron 17 errores en 9 archivos que requieren **refactor real** del código, no solo casts y assertions:

| Origen | # | Tipo de drift |
|---|---|---|
| `MiCuentaTab.tsx` · `session.account.tier` | 2 | Schema field no expuesto en SessionData |
| `MiPerfilTab.tsx` · `session.user.phone/documentNumber` | 4 | Idem |
| `catalogos/conductores/actions.ts` · `getPersonRelationCounts` | 1 | Query removida sin reemplazo |
| `catalogos/grupos/actions.ts` · `getGroupRelationCounts/getGroupDescendantIds` | 2 | Idem |
| `viajes/page.tsx` · `listGroupsForFilter(arg)` | 1 | Signature drift · query no acepta arg |
| `admin/usuarios/page.tsx` · `getAccountsForFilter(string[])` | 1 | Signature drift · query no acepta array |
| `TripsClient.tsx` · DaysList/TripDetailPanel/TripsRoutesMap | 4 | Refactor incompleto · prop names desincronizados |
| `ConfiguracionClient.tsx` · `"cuenta"` no en `SectionKey` | 2 | Archivo legacy reemplazado por `ConfiguracionShell` |

## Decisiones

### 1. Session shape · agregar campos del schema que no se exponían

`User.phone`, `User.documentNumber` y `Account.tier` ya existen en el schema Prisma. La consulta `db.user.findFirst({ include: { account: true } })` ya los carga · simplemente no se mapeaban a `SessionData`. Solución · agregarlos al tipo y al `mapUser` helper.

**Trade-off considerado:** ¿hacer estos campos optional en `SessionData` o requeridos? Decisión: **requeridos en SessionData** con `null` cuando no hay valor. Esto fuerza al código consumidor a manejar el null explícitamente (mejor que `undefined` silencioso), y refleja la realidad de la DB.

### 2. Queries pre-delete reimplementadas

`getPersonRelationCounts` y `getGroupRelationCounts` chequean si una entidad tiene relaciones que impiden borrarla. Implementación con `Promise.all` de counts por relación · query barata.

`getGroupDescendantIds` previene ciclos en la jerarquía de grupos al editar. Implementación BFS iterativo con cap defensivo de profundidad 16 (en realidad ADR-001 limita a 2 niveles, pero el cap es seguro contra inconsistencias de DB).

### 3. Signature drifts

`listGroupsForFilter` ahora acepta `accountId?: string | null`. El comportamiento previo (sin filtro) se mantiene cuando no se pasa argumento.

`getAccountsForFilter` ampliado a `string | string[] | null`. Cuando recibe array, usa Prisma `where: { id: { in: [...] } }`. Backward compatible · el caller existente que pasa `string` sigue funcionando.

### 4. TripsClient resync

Estado pre-fix · `TripsClient` usaba modelo "selección por item" pero pasaba props como si DaysList fuera "selección por día" y TripDetailPanel fuera "selección por item directo". Estaba a mitad de una migración.

**Decisión:** completar la migración hacia el modelo "selección por item" sin tocar DaysList ni TripDetailPanel · solo TripsClient cambia.

- `DaysList` recibe `selectedDayId={selection?.day.id ?? null}` · derivar día desde el item seleccionado
- `onSelectDay(dayId)` · al hacer click en una fila, se selecciona el primer item del día
- `TripDetailPanel` recibe `selectedItemId/onSelectItem` (ya tenía esas props · no se tocan)
- `routes` ahora incluye `assetName: day.assetName` · campo requerido por `TripsRoutesMap`

**Alternativa descartada:** migrar DaysList al modelo "items" requeriría rediseñar la tabla (cada día tiene N items). El modelo actual "fila por día" es más legible y matchea la UX de Samsara/Geotab.

### 5. ConfiguracionClient · borrar archivo legacy

Verificación con grep · `ConfiguracionClient.tsx` NO se importa desde ningún lado. `page.tsx` solo usa `ConfiguracionShell`. El archivo es código muerto que sobrevivió a una refactorización del módulo Configuración (donde "cuenta" se desglosó en "empresa-datos", "empresa-umbrales", etc.).

Solución · `git rm`. No requiere cambios en otros archivos.

## Consecuencias

### Positivas

- Typecheck queda en 0 errores · `tsc --noEmit` puede ejecutarse en CI como gate.
- Habilita L1.5c · sacar `ignoreBuildErrors: true` de `next.config.ts` (1 línea).
- `SessionData` refleja la DB real · evita futuros bugs de "el campo está en Prisma pero no se ve en UI".
- Las 3 queries pre-delete viven en `lib/queries/` con tipos explícitos · reusable desde otras pantallas si surge la necesidad.

### Negativas

- `MiCuentaTab` y `MiPerfilTab` ahora muestran `null` cuando phone/documentNumber están vacíos. Si la UX original mostraba `"—"` o vacío, hay que verificar visualmente que se siga viendo igual (ambas fields tienen `?? ""` en sus inputs · revisado).
- El borrado de `ConfiguracionClient.tsx` es destructivo · si en algún branch experimental se usa, se rompe. Mitigación · grep confirmó cero usos en main.
- `TripsClient` ahora tiene una pequeña asimetría · click en fila selecciona el primer item, pero hay días con 1 trip y otros con N. UX puede ser confusa para días con muchos items. Trade-off aceptable · el panel deja al usuario refinar la selección.

### Nulas

- No requiere cambio de schema.
- No afecta runtime de Vercel build (sigue pasando con o sin `ignoreBuildErrors`).
- No afecta otros consumers de `getAccountsForFilter` (cambio backward compatible).

## Validación

```bash
# Esperado · típecheck limpio
npx tsc --noEmit; echo exit=$?

# Esperado · build sigue OK
npm run build
```

Si typecheck = 0 · proceder con **L1.5c** (1 línea · sacar `ignoreBuildErrors`).

## Referencias

- L1.5a · ADR-011 · approach mecánico (precedente)
- HANDOFF.md · BLOQUE 1.5 · TypeScript cleanup
- Schema · `prisma/schema.prisma` · campos `User.phone`, `User.documentNumber`, `Account.tier` ya existían
- ADR-001 · jerarquía de grupos máx 2 niveles (referencia para el cap defensivo de getGroupDescendantIds)
