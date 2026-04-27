# DOC-11 · Naming Conventions

> Sub-documento del Data Model.
> Convenciones de nombres en schema Prisma, queries, tipos TypeScript,
> archivos y URLs.
> Si hay un conflicto entre dos convenciones, la regla más específica gana.

---

## 1 · Schema Prisma

### 1.1 · Models (entidades)

| Aspecto | Convención | Ejemplo |
|---|---|---|
| Nombre del model | `PascalCase` singular | `Asset`, `Person`, `Alarm` |
| Plural en relations | nombre de campo plural en lowercase | `assets`, `events`, `alarms` |
| Filenames de migration | timestamp + descripción | `20260424231054_init` |

**Reglas:**
- Singular siempre. `Asset`, no `Assets`. La pluralización aparece en el
  campo de relación, no en el nombre del model.
- Si el dominio tiene una palabra natural en español que es ambigua en
  inglés, mantener el inglés del schema y traducir solo en UI. Ej:
  `Person` (no `Driver` ni `Conductor`) porque la entidad existe
  independiente de su rol.

### 1.2 · Fields (campos)

| Aspecto | Convención | Ejemplo |
|---|---|---|
| Nombre del campo | `camelCase` | `firstName`, `licenseExpiresAt` |
| FK de otra entidad | `<entityName>Id` | `accountId`, `personId`, `currentDriverId` |
| Boolean | prefijo `is` o `has`, **no** verbo | `isPrimary`, `hasMaintenance` (no `enabled` solo) |
| Timestamp `DateTime` | sufijo `At` (eventos) o sin sufijo (configuración) | `createdAt`, `triggeredAt`, `licenseExpiresAt` |
| Counters | sufijo `Count` | `eventCount`, `alarmCount` |
| Métricas con unidad | sufijo de unidad | `speedKmh`, `distanceKm`, `costAmount` |
| Coordenadas | `lat` y `lng` (no `latitude`/`longitude`, no `lon`) | `lat`, `lng` |
| Booleans con default | siempre poner `default()` explícito | `isPrimary Boolean @default(false)` |

**Reglas:**
- `accountId` siempre se llama así, en cualquier entidad. Coherencia >
  brevedad.
- Los campos terminados en `At` son momentos puntuales. `expirationDate`
  no se usa — se usa `expiresAt` (es lo mismo, pero consistente).
- Una unidad en el nombre del campo evita preguntas: `speedKmh` no deja
  duda si son km/h, m/s o mph.

### 1.3 · Enums

| Aspecto | Convención | Ejemplo |
|---|---|---|
| Nombre del enum | `PascalCase` singular | `AssetStatus`, `Severity` |
| Valores | `SCREAMING_SNAKE_CASE` | `OPEN`, `IN_PROGRESS`, `HARSH_BRAKING` |

**Reglas:**
- Valor con dos palabras → underscore: `IGNITION_ON`, `SPEEDING_CRITICAL`.
- No mezclar idiomas. Si el dominio tiene una palabra naturalmente
  española (ej: `BOLETIN`), se traduce a inglés en el schema (`BULLETIN`)
  y la UI muestra el español.
- Evitar redundancia: `AssetStatus.MOVING`, no `AssetStatus.STATUS_MOVING`.

### 1.4 · Relations

```prisma
model Asset {
  // FK explícita
  accountId  String
  // Relación nombrada
  account    Account @relation(fields: [accountId], references: [id])

  // Relación inversa con nombre explícito si hay > 1 relación al mismo target
  currentDriverId String?
  currentDriver   Person? @relation("CurrentDriver", fields: [currentDriverId], references: [id])
}

model Person {
  // El otro lado de la relación nombrada
  drivenAssets Asset[] @relation("CurrentDriver")
}
```

**Reglas:**
- Si una entidad tiene **una sola** relación a otro model, no hace falta
  nombre explícito.
- Si tiene **dos o más**, **todas** las relaciones a ese model deben
  tener nombre con `@relation("Nombre")`.
- El campo de la FK siempre va antes que el campo de la relación:
  `accountId` se declara antes que `account`.

### 1.5 · Indexes

```prisma
@@index([accountId, status])              // compuesto, orden importa
@@index([assetId, recordedAt])            // siempre el FK primero
@@index([accountId, status, triggeredAt]) // 3 columnas, OK si la query lo necesita
```

**Reglas:**
- Compuestos en orden de selectividad (más selectivo primero).
- Documentar inline (con comentario `///`) cuando un index responde a
  una query específica.
- No agregar indexes "por las dudas" — cada index cuesta en writes.

### 1.6 · Defaults

```prisma
id        String   @id @default(cuid())
createdAt DateTime @default(now())
status    AssetStatus @default(IDLE)
isPrimary Boolean  @default(false)
safetyScore Int    @default(75)
```

**Reglas:**
- IDs: `cuid()`. Más legibles que UUIDs en URLs y logs, sin colisiones a
  escala razonable. No usar `autoincrement()` — los enteros expuestos en
  URL son anti-pattern de seguridad.
- Timestamps: `now()` para `createdAt`. Para otros (ej `triggeredAt`)
  setear desde aplicación.
- Booleans nunca quedar sin default. La indeterminación de `null` es bug.

---

## 2 · Queries (TypeScript / Prisma Client)

### 2.1 · Funciones de query

Archivo: `src/lib/queries/<dominio>.ts`. Cada archivo agrupa queries
relacionadas a un dominio.

| Patrón | Convención | Ejemplo |
|---|---|---|
| Listar | `list<Entity>(params?)` | `listAssets(params)` |
| Obtener uno | `get<Entity>ById(id)` o `get<Entity>Detail(id)` | `getAssetDetail(id)` |
| Conteos | `get<Entity>Counts(filter?)` | `getAssetStatusCounts({ accountId })` |
| Top-N | `getTop<Entity>By<Metric>(limit?)` | `getTopAssetsByEvents(5)` |
| KPIs agregados | `get<Domain>Kpis(filter?)` | `getSafetyKpis()` |
| Filtros para dropdowns | `get<Entity>ForFilter()` | `getAccountsForFilter()` |

**Reglas:**
- Funciones empiezan con verbo (`list`, `get`, `find`, `count`).
- Devuelven tipos enriquecidos cuando hace sense (definidos en
  `src/types/domain.ts`), no el tipo Prisma raw.
- Parámetros opcionales todos juntos en un único objeto:
  `listAssets({ search, status, page })`.

### 2.2 · Tipos de query results

| Sufijo | Significado | Ejemplo |
|---|---|---|
| `Row` | Registro plano para una tabla/lista | `AssetListRow` |
| `Detail` | Objeto enriquecido para vista detalle | `AssetDetail` |
| `WithRefs` | Incluye referencias joined | `AlarmWithRefs` |
| `Result` | Wrapper con metadata (paginación, total) | `AssetListResult` |

```ts
// Ejemplo de uso conjunto
interface AssetListResult {
  rows: AssetListRow[];
  total: number;
  page: number;
  pageCount: number;
}
```

### 2.3 · Where/orderBy

Cuando filtros son condicionales, usar spread con expresiones ternarias:

```ts
const where: Prisma.AssetWhereInput = {
  ...(status ? { status } : {}),
  ...(accountId ? { accountId } : {}),
  ...(search ? {
    OR: [
      { name: { contains: search } },
      { plate: { contains: search } },
    ],
  } : {}),
};
```

No usar `if` con mutación de objeto (más feo, type-narrowing peor).

---

## 3 · Tipos TypeScript

### 3.1 · Re-exports

`src/types/domain.ts` re-exporta los tipos Prisma generados para que el
resto del código importe desde `@/types/domain`, no desde `@prisma/client`
directamente.

Razón: si en el futuro reemplazamos Prisma o renombramos algo, hay un
único punto de cambio.

```ts
// ✅ correcto
import type { Asset, AssetStatus } from "@/types/domain";

// ❌ evitar
import type { Asset, AssetStatus } from "@prisma/client";
```

### 3.2 · Tipos enriquecidos vs base

```ts
// Tipo Prisma base (solo campos directos)
import type { Asset } from "@/types/domain";

// Tipo enriquecido para una pantalla específica
export interface AssetListRow extends Asset {
  group: Pick<Group, "id" | "name"> | null;
  currentDriver: Pick<Person, "id" | "firstName" | "lastName" | "safetyScore"> | null;
  lastPosition: Pick<Position, "lat" | "lng" | "speedKmh" | "recordedAt"> | null;
}
```

**Reglas:**
- Usar `Pick<>` en lugar de incluir todos los campos. Refleja exactamente
  qué carga la query y limita el contrato.
- Sufijo del tipo describe **dónde se usa** (`ListRow`, `Detail`,
  `WithRefs`).

### 3.3 · Tipos de búsqueda/URL

Los tipos para `searchParams` van en `src/lib/url.ts`:

```ts
export interface AssetsSearchParams {
  search: string | null;
  accountId: string | null;
  status: AssetStatus | null;
  // ...
}
```

`null` (no `undefined`) para señalar "explícitamente vacío". Esto es
crítico para el patrón de overrides con `Partial<AssetsSearchParams>`.

---

## 4 · Archivos y carpetas

### 4.1 · Estructura general

```
src/
├── app/                       # Next.js App Router
│   ├── <route>/
│   │   ├── page.tsx           # default export del page
│   │   ├── page.module.css    # styles del page
│   │   └── layout.tsx         # opcional, layout específico
├── components/
│   ├── shell/                 # ModuleBar, Sidebar, Topbar
│   └── maxtracker/            # componentes específicos del producto
│       ├── KpiTile.tsx
│       └── KpiTile.module.css
├── lib/
│   ├── db.ts                  # Prisma client singleton
│   ├── format.ts              # helpers de presentación
│   ├── url.ts                 # parseo/construcción de searchParams
│   └── queries/               # funciones de query por dominio
│       ├── safety.ts
│       ├── assets.ts
│       ├── alarms.ts
│       └── events.ts
└── types/
    └── domain.ts              # tipos enriquecidos
```

### 4.2 · Naming de componentes

| Aspecto | Convención | Ejemplo |
|---|---|---|
| Filename del componente | `PascalCase.tsx` | `AlarmCard.tsx` |
| CSS Module pareado | `<Component>.module.css` | `AlarmCard.module.css` |
| Componente exportado | mismo nombre que el archivo | `export function AlarmCard()` |
| Barrel export | `index.ts` por carpeta | `components/maxtracker/index.ts` |
| Server vs Client | Client tiene `"use client"` arriba | Server por default (sin directive) |

### 4.3 · Naming de tests (futuro · no implementado en Lote 1)

```
ComponentName.test.tsx
queryName.test.ts
```

Co-located con el código (mismo folder), no en `__tests__/`.

---

## 5 · URLs

### 5.1 · Path conventions

| Patrón | Convención | Ejemplo |
|---|---|---|
| Módulo | `/[modulo]` | `/seguridad`, `/conduccion` |
| Lista de entidad | `/[modulo]/[entidad]` | `/seguridad/assets` |
| Detail de entidad | `/[modulo]/[entidad]/[id]` | `/seguridad/assets/abc123` |
| Sub-recurso | `/[modulo]/[entidad]/[id]/[subentidad]` | `/seguridad/assets/abc123/eventos` |

**Reglas:**
- Paths en español (no inglés). UI es español → URL es español.
- Plural para listas (`/assets`), singular conceptual para details
  (pero usando el mismo plural para uniformidad: `/assets/abc`).
- Slugs no se usan en demo (cuid en URL). En producción podríamos cambiar
  a slugs cuando lleguemos a entidades con nombres únicos por account.

### 5.2 · Query parameters

| Patrón | Convención | Ejemplo |
|---|---|---|
| Filtros | `<field>=<value>` | `?status=OFFLINE&accountId=abc` |
| Búsqueda | `search=<query>` | `?search=camion` |
| Sort | `sort=<field>&dir=<asc\|desc>` | `?sort=name&dir=asc` |
| Paginación | `page=<n>` | `?page=3` |
| Tabs | `tab=<key>` | `?tab=alarmas` |

**Reglas:**
- Defaults se omiten de URL: `dir=asc` no aparece, solo `dir=desc`.
- `page=1` no aparece, solo `page=2+`.
- Si hay null/empty, no se incluye el param.
- Boolean params usar `1`/`0`, no `true`/`false` (más cortos).

### 5.3 · Order de query params

Dentro de la URL no hay orden estricto, pero `buildAssetsHref` produce
siempre el mismo orden para que las URLs sean visualmente consistentes:

```
search → accountId → groupId → status → mobility → sort → dir → page
```

---

## 6 · ADRs

### 6.1 · Naming

```
docs/adr/ADR-NNN-kebab-case-summary.md
```

| Aspecto | Convención |
|---|---|
| Numeración | 3 dígitos consecutivos: `ADR-000`, `ADR-001`, …, `ADR-100` |
| Filename | kebab-case con slug descriptivo |
| Título dentro del archivo | `# ADR-NNN — Título` |

### 6.2 · Estructura interna

Cada ADR tiene **siempre** estas secciones:

```
# ADR-NNN — Título corto

**Status:** Proposed | Accepted | Rejected | Superseded
**Date:** YYYY-MM-DD
**Decider:** quién lo decidió
**Supersedes:** ADR-X o —
**Superseded by:** ADR-Y o —

## Context
## Decision
## Rationale (o Alternatives considered)
## Consequences
  ### Positive
  ### Negative
  ### Neutral
## Implementation
```

### 6.3 · DS-XXX (Design System)

Las decisiones de diseño se enumeran como `DS-001`, `DS-002`, etc.,
dentro de DOC-10. **No** son ADRs separados — viven inline en
`docs/design-system/DOC-10-design-system.md`.

Si una decisión de diseño justifica ADR completo (ej: cambiar de CSS
Modules a Tailwind), entonces se crea un ADR formal y se referencia
desde DOC-10.

---

## 7 · Mensajes de commit

Convención adoptada para este proyecto, basada en la práctica de
**Conventional Commits** simplificada:

```
Sub-lote X.Y · Descripción corta

[Opcional: cuerpo del mensaje]
```

Ejemplos:

```
✅ Sub-lote 2.2 · Data Model DOC-11
✅ Sub-lote 2.3 · ADR-005 Server Components first
✅ Hotfix · padding del KpiTile en mobile
✅ Refactor · extraer dotSep a globals.css
```

**Reglas:**
- Primera línea ≤ 72 caracteres
- Sin punto al final
- Verbo en español o sustantivo (consistente con el equipo)
- Si toca múltiples archivos sin un sub-lote claro, usar prefijo:
  `Hotfix ·`, `Refactor ·`, `Docs ·`, `Chore ·`

---

## 8 · Anti-patterns explícitos

Cosas que NO hacemos en el sistema, listadas para evitar que aparezcan
por inercia:

### Schema

❌ Plurales en nombres de model (`Assets`)
❌ snake_case en field names (`first_name`)
❌ FKs sin sufijo `Id` (`account` String FK directo)
❌ Booleans sin default
❌ Enums con valores sin SCREAMING_SNAKE_CASE
❌ Indexes sin documentación inline cuando responden a queries específicas

### TypeScript

❌ `import` directo de `@prisma/client` fuera de `src/types/domain.ts`
❌ Tipos enriquecidos sin sufijo de uso (`AssetWithStuff`)
❌ Funciones de query sin verbo prefix
❌ `any` en cualquier parte del dominio

### URLs

❌ Mezclar inglés y español (`/security/activos`)
❌ IDs autoincrementales en URL
❌ Defaults explícitos en query params (`?page=1`)
❌ Search vacío como `?search=`

### Archivos

❌ Componentes en kebab-case (`alarm-card.tsx`)
❌ CSS Modules con nombre distinto al componente
❌ Mezclar Server y Client en el mismo archivo

---

## 9 · Cuándo violar las reglas

Las convenciones son **default**, no ley. Una excepción se justifica
con un comentario explícito:

```ts
// EXCEPTION: este campo viene de la API legacy de Teltonika que usa
// snake_case. Lo mantenemos hasta que migremos el adapter.
imei_raw String?
```

Si una excepción se aplica a múltiples lugares, conviene convertirla en
nueva regla con ADR.

---

## 10 · Versioning

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 2026-04-25 | Convenciones extraídas del Lote 1 (Sub-lote 2.2) |
