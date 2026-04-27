# ADR-003 — URL state pattern para listas y tabs

**Status:** Accepted
**Date:** 2026-04-25
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator
**Supersedes:** —
**Superseded by:** —
**Context:** Sub-lote 1.4 (Lista A) + Sub-lote 1.5 (Tabs en Libro B)

## Context

Las pantallas de Maxtracker tienen estado "interactivo" que el usuario
manipula durante su trabajo: filtros aplicados, columna de orden, página
actual, tab activo. Hay dos lugares donde puede vivir ese estado:

1. **React state** (`useState`) — clásico, fácil de programar
2. **URL searchParams** — la URL refleja qué está viendo el usuario

La diferencia parece menor pero tiene impacto operativo grande. Caso real:
un dispatcher quiere mostrarle a su supervisor "todos los assets OFFLINE
del grupo Refrigerados". Si el estado vive en React, el dispatcher tiene
que pedirle al supervisor que **replique** los clicks. Si vive en URL,
copia el link y listo.

## Decision

**Todo estado de filtros, ordenamiento, paginación y tabs en pantallas
de Maxtracker se persiste en URL searchParams como source of truth.**

Pattern de implementación:

- Las páginas son Server Components que reciben `searchParams` (asíncrono
  en Next.js 15)
- Un módulo `lib/url.ts` por dominio: `parseAssetsParams()`,
  `buildAssetsHref()`, `hasActiveFilters()`
- Los componentes interactivos (FilterBar, Pagination, SortHeader, Tabs)
  emiten `<Link>` con la nueva URL, no `useState`
- Solo cuando hay un input "uncomitted" (texto del search antes de Enter)
  se usa state local · y se commitea on Enter o on blur

Defaults se omiten: `?page=1` no aparece, solo `?page=2+`. URLs limpias.

## Rationale

1. **Compartibilidad.** El uso operativo de Maxtracker es 80% trabajo
   compartido (dispatcher → supervisor → operario). URLs compartibles son
   un multiplicador real de productividad.

2. **Browser history funciona.** Botones back/forward del browser
   navegan entre estados como espera el usuario, sin que tengamos que
   sincronizar manualmente con `history.pushState`.

3. **Refresh no pierde estado.** Si el dev server reinicia, si el browser
   crashea, si el usuario apaga el laptop y vuelve mañana, el estado de
   pantalla se preserva en el bookmark / pestaña abierta.

4. **Server Components first.** Next.js 15 lee searchParams en el server
   sin JS. Una pantalla con filtros aplicados se renderiza completa antes
   de hidratar — más rápido y SEO-friendly.

5. **Auditabilidad.** Los logs de acceso del server muestran exactamente
   qué filtros aplicó el usuario. Útil para debugging y analytics.

## Alternatives considered

- **React state puro (useState):** rechazado. Pierde compartibilidad,
  back/forward no funciona, refresh borra todo.

- **localStorage / sessionStorage:** rechazado. Persiste demasiado
  (filtros aplicados ayer aparecen hoy sin querer), no es compartible
  via link, no funciona en pestañas privadas.

- **Server-side session state:** rechazado. Requiere infra de sesión,
  acopla pantalla a usuario, no compartible cross-user.

- **Híbrido:** rechazado por inconsistencia. Si filtros van en URL pero
  paginación en state, el usuario ve comportamientos distintos sin
  razón aparente.

## Consequences

### Positive

- URLs compartibles para cualquier estado de pantalla
- Browser back/forward funciona "gratis"
- Refresh preserva exactamente lo que el usuario veía
- Server Components leen el estado sin client-side JS
- Patrón único reutilizable en cualquier futura pantalla con filtros

### Negative

- Cambio de filtro = navegación SSR completa. En el demo (80 assets) es
  invisible; con 10k+ podría sentirse. Mitigación futura: client-side
  re-fetch con shallow routing cuando aplique.
- URLs largas si hay muchos filtros activos. No es un problema real
  hasta los 2KB de límite del browser.
- El input de search necesita state local (uncomitted) → leve excepción
  al patrón puro

### Neutral

- Requiere que cada pantalla tenga su `lib/url.ts` propio. Refactor
  futuro podría generalizar a un helper, pero por ahora cada pantalla
  tiene formas distintas y mejor explícito.

## Implementation

Implementado en Sub-lote 1.4:

- `src/lib/url.ts` — `parseAssetsParams`, `buildAssetsHref`, `hasActiveFilters`
- `src/app/seguridad/assets/page.tsx` — página que consume searchParams
- `src/components/maxtracker/AssetFilterBar.tsx` — Client component que
  navega via `router.push(buildAssetsHref(...))`
- `src/components/maxtracker/Pagination.tsx` — links pre-construidos
- `src/components/maxtracker/SortHeader.tsx` — links que flippean dir

Replicado en Sub-lote 1.5 para Tabs:

- `src/components/maxtracker/Tabs.tsx` — usa `?tab=<key>` con primer tab
  como default sin param (URL canónica)

Convención URL canónica documentada en `naming-conventions.md` §5.
