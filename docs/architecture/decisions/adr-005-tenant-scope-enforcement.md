# ADR-005 · Tenant scoping enforcement con `resolveAccountScope`

> **Estado:** Aceptado (parcialmente implementado en U1, completar en U1b)
> **Fecha:** 2026-04-30
> **Autor:** Alejandro + Claude

---

## Contexto

El sistema soporta multi-tenancy desde el modelo (`Account`, `User.accountId`,
queries que admiten filtro por `accountId`), y el módulo de permisos
declara explícitamente el `scope` de cada role:

```ts
// src/lib/permissions.ts
CLIENT_ADMIN: dataModulesPerm(true, true, "OWN_ACCOUNT")
OPERATOR:     dataModulesPerm(true, false, "OWN_ACCOUNT")
SUPER_ADMIN:  todo con scope ALL (implícito · cross-account)
```

Y existe el helper `getScopedAccountIds(session, module)` que devuelve:
- `null` · cross-account · sin filtro
- `[]` · sin permiso · query no debe devolver nada
- `[id]` · OWN_ACCOUNT · solo ese accountId

**El problema:** auditando el código en abril 2026, descubrimos que
**ningún consumer importa o usa `getScopedAccountIds`**. Las páginas
operativas (`/catalogos/vehiculos`, `/seguimiento/mapa`, `/seguimiento/historial`,
etc.) toman el `accountId` del **searchParam** (filtro de UI) y lo pasan
tal cual al query. Si el filtro está vacío, no hay filtro.

**Consecuencia:** un CLIENT_ADMIN o OPERATOR que entra a estas páginas
**ve datos de las 4 cuentas del seed**, no solo de la suya. Violación
fundamental de multi-tenancy.

El control de **acceso a /admin/\*** está bien (CA y OP no tienen
`backoffice_*: read`, así que redirect con `canRead`). El bug está en las
páginas operativas que SÍ permiten lectura pero no scopean.

## Decisión

Introducir un helper `resolveAccountScope(session, module, requestedFilter)`
que se aplica **siempre** en páginas multi-tenant. El helper:

- Si user es cross-account (SA, MA): respeta el filtro de UI · si no hay
  filtro, devuelve `null` (sin filtro · ve todo)
- Si user tiene scope OWN_ACCOUNT (CA, OP): **fuerza** al `accountId` del
  session, ignorando el filtro de UI
- Si user no tiene permiso de read: devuelve `NEVER_MATCHING_ACCOUNT`
  (sentinel que garantiza query vacía como defense in depth)

Las queries que ya aceptan `accountId?: string | null` lo respetan
naturalmente. Las que no lo aceptan se extienden para hacerlo.

Adicionalmente, un helper `canFilterByAccount(session, module)` permite
a la UI saber si debe **mostrar** el dropdown "Cliente" en filterbars
(para CA y OP no se muestra · solo confunde, no se va a respetar).

## Alternativas consideradas

| Opción | Pros | Contras | Por qué se descartó |
|---|---|---|---|
| **A** · Postgres RLS desde el día 1 | El motor garantiza el aislamiento · cero código de scoping en queries | SQLite no tiene RLS · imposible hasta migrar | Diferido a la migración a Postgres |
| **B · (elegida)** · Helper aplicado en cada página + querying con accountId | Funciona en SQLite y Postgres · simple · explícito · refactorizable a RLS sin perder funcionalidad cuando llegue Postgres | Cada página tiene que recordarse de aplicarlo · si alguien agrega una página y olvida, hay bug · necesita disciplina | — |
| **C** · Middleware Prisma que aplica accountId automáticamente desde un context | Imposible olvidarse · cero boilerplate por página | Magic implícita · debugging difícil · context de session no es trivial pasarlo a Prisma desde un Server Component | Demasiado mágico para v1 · puede evaluarse en v2 con un AsyncLocalStorage para context |
| **D** · No hacer scoping y confiar en que las páginas hagan redirect de no-permitidos | El sistema actual sin tocar | No funciona · CA y OP TIENEN permiso de read en `seguimiento`, `catalogos`, etc. con `scope: OWN_ACCOUNT` · el redirect no aplica | El scope actual no se enforced · ese es el bug |

## Consecuencias

### Positivas

- **Aislamiento real entre tenants** desde la capa de aplicación
- **Migración a RLS futura es trivial** · el helper se vuelve no-op
  cuando RLS lo enforced a nivel motor (Postgres)
- **API de queries ya soportaba `accountId`** · se aprovecha la
  infraestructura existente sin breaking changes
- **`canFilterByAccount` mejora la UX** · CA y OP no ven dropdowns que
  no aplican

### Negativas / costos

- **Disciplina requerida**: cada nueva página multi-tenant tiene que
  recordar invocar `resolveAccountScope`. **Mitigación**: documentar
  en `code-conventions.md`, agregar comentario al helper que lo recuerde,
  considerar un test E2E que verifique scoping para cada página crítica.
- **Queries existentes que no aceptan `accountId`** se tienen que
  extender. En este lote (U1) se extendieron 2: `getFleetReplay`,
  `getFleetLive`, `listMobileAssetsForFilter`. En U1b se extenderán
  el resto.
- **Filtros UI complejos a refactorizar**: cuando un dropdown de
  cuenta se renderiza pero no aplica (por scope), hay que ocultarlo
  · cambio de cada FilterBar. Pendiente para U1b.

### Trade-offs

- **Explícito en cada página** vs **implícito via middleware**:
  elegimos explícito porque debugging es trivial · el implícito requiere
  AsyncLocalStorage o equivalente y agrega mucha magia para v1

## Plan de implementación

### Lote U1 (parcial · este)

✓ Crear `src/lib/queries/tenant-scope.ts` con `resolveAccountScope`,
  `canFilterByAccount`, `NEVER_MATCHING_ACCOUNT`
✓ Aplicar en `/catalogos/vehiculos` (página y queries `listAssets`,
  `getAssetStatusCounts`)
✓ Aplicar en `/seguimiento/mapa` (extender `getFleetReplay` y
  `getFleetLive` con `accountId` opcional)
✓ Aplicar en `/seguimiento/historial` (extender
  `listMobileAssetsForFilter`)

### Lote U1b (próximo · pendiente)

- Aplicar en `/actividad/viajes` (extender `listTrips` y
  `listTripsAndStopsByDay` con `accountId`)
- Aplicar en `/actividad/scorecard`, `/actividad/analisis`,
  `/actividad/reportes`
- Aplicar en `/seguimiento/torre-de-control`, `/reportes`, `/analisis`
- Aplicar en módulos `/seguridad/*`, `/direccion/*`, `/objeto/*`
- Refactorizar `getAccountsForFilter()` para que devuelva solo las
  accounts visibles al user
- Modificar `AssetFilterBar`, `HistoricosFilterBar`, etc. para ocultar
  el dropdown "Cliente" cuando `canFilterByAccount() === false`
- Agregar tests E2E que validen scoping (corriendo cada página como CA
  de cada cuenta y verificando que solo ve los suyos)

### Lote U1c (futuro · cuando migremos a Postgres)

- Implementar Row Level Security en Postgres con policies por tabla
- `resolveAccountScope` se mantiene como defense in depth + para UX
  (filtros UI), pero el aislamiento real pasa a ser del motor
- Queries dejan de necesitar el `where: { accountId }` explícito · RLS
  lo agrega transparentemente

## Trigger para revisar

Esta decisión se revisa si:

1. Aparece un caso real donde necesitamos un user con scope
   `MULTI_ACCOUNT` (visibilidad sobre N accounts hijos en una
   jerarquía de holding) · `getScopedAccountIds` ya devuelve array,
   pero `resolveAccountScope` hoy solo usa `[0]` · habría que extender
2. Se completa la migración a Postgres y queremos enforcement por motor
   (RLS) · disparador para U1c

## Referencias

- Doc Maestro · sección 7 (Multi-tenancy y permisos · §7.1.1 enuncia
  RLS como decisión adoptada para Postgres)
- Doc Maestro · sección 13 invariante I1 ("`account_id` es el boundary
  de toda operación de datos")
- Doc Maestro · invariante I11 ("RLS aplicada a nivel motor, no
  aplicación · Filtrado entre tenants si bug en código") · este ADR
  materializa ese principio en el período pre-Postgres
- Implementación: `src/lib/queries/tenant-scope.ts`
- Helper preexistente reutilizado: `getScopedAccountIds` en
  `src/lib/permissions.ts`
- Lote U1 · primera implementación parcial
