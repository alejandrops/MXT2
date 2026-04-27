# ADR-004 — Component layering en 5 capas

**Status:** Accepted
**Date:** 2026-04-25
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator
**Supersedes:** —
**Superseded by:** —
**Context:** Lote 1 evidence + DOC-10 (Design System)

## Context

A medida que el sistema crece, la organización de componentes se vuelve
crítica. Sin reglas, todo termina en un único folder gigante con
dependencias cruzadas que hacen imposible reutilizar piezas o predecir
el impacto de un cambio.

Durante el Lote 1 emergió una estructura de **5 capas naturales** que
funcionó bien y que conviene formalizar antes de seguir agregando
componentes en lotes futuros.

## Decision

Adoptar **5 capas estrictas** de componentes, con la regla:

> Una capa solo puede importar de capas inferiores.

Las capas, de la base al tope:

```
1. Tokens          (CSS vars en globals.css)
2. Primitives      (KpiTile, StatusPill, SectionHeader, Tabs, LeafletMap)
3. Cards           (AlarmCard, DriverScoreCard, AssetEventCard, EventRow)
4. Lists & tables  (AssetTable, SortHeader, Pagination, AssetFilterBar)
5. Composites      (AssetHeader)
6. Pages           (page.tsx en src/app/...)
```

Cada capa tiene una responsabilidad acotada y dependencias permitidas.

## Rationale

1. **Predictibilidad de impacto.** Si toco un token, sé que afecta
   potencialmente todo el sistema. Si toco un Page, sé que solo afecta
   esa pantalla.

2. **Reutilización ascendente.** Un Primitive como `KpiTile` se usa en
   Dashboard D, Lista A, Libro B. Si Cards pudieran importar de otras
   Cards, perdemos esa garantía de reutilización limpia.

3. **Testing aislado.** Un Primitive se testea standalone con props
   sintéticas. Un Page tiene fetches y state. Las capas reflejan el
   gradiente de "puro → contextual".

4. **Onboarding más simple.** Un dev nuevo entiende dónde poner cada
   componente nuevo siguiendo la capa.

5. **Refactors localizados.** Cambiar un Composite (AssetHeader) no
   debería tocar Cards. Si tiene que tocar, es señal de que el Card
   absorbió responsabilidad equivocada.

## Capas en detalle

### Capa 1 · Tokens
`src/app/globals.css`. CSS custom properties, variables, families,
escalas. Sin JS, sin componentes.

### Capa 2 · Primitives & layout
Componentes atómicos sin lógica de dominio. Solo conocen tokens.
Reciben props, renderizan UI. Ejemplos: KpiTile, StatusPill,
SectionHeader, Tabs, LeafletMap.

### Capa 3 · Cards
Visualización de un objeto del dominio (alarma, conductor, evento,
asset). Importa Primitives y tokens. Conoce los tipos del dominio.
Ejemplos: AlarmCard, DriverScoreCard, AssetEventCard, EventRow.

### Capa 4 · Lists & tables
Componentes que renderizan colecciones, con filtros, sort, paginación.
Importan Cards y Primitives. Ejemplos: AssetTable, AssetFilterBar,
Pagination, SortHeader.

### Capa 5 · Composites
Componentes que combinan múltiples capas inferiores en una unidad
reutilizable. AssetHeader combina StatusPill + relativeTime + meta-row.
Reservada para casos que aparecen en > 1 pantalla.

### Capa 6 · Pages
Server Components en `src/app/...`. Hacen fetch, componen capas
inferiores, manejan layout específico. No exportan componentes.

## Alternatives considered

- **Atomic Design (atoms / molecules / organisms / templates / pages):**
  rechazado. Demasiada granularidad para un equipo chico. La distinción
  atom/molecule confunde más de lo que aclara.

- **Feature folders (cada "feature" tiene sus componentes adentro):**
  rechazado en este lote porque favorece duplicación cross-feature. Lo
  reconsideramos cuando tengamos > 4 módulos productivos (Lote 4+).

- **Plain folder con todos juntos:** rechazado. No escala más allá de
  ~30 componentes.

## Consequences

### Positive

- Reglas claras de dónde poner cada componente nuevo
- Imports siempre fluyen hacia arriba (no hay ciclos)
- Refactors localizados a una capa
- Testing más simple en capas bajas

### Negative

- Algunas decisiones requieren juicio: ¿esto es Primitive o Card?
  Mitigación: cuando dudás, va al nivel **más bajo** que pueda funcionar.
- Composites es la capa más "vacía" (solo AssetHeader). Riesgo de que
  no se use → reconsiderar en Lote 3 si sigue así.

### Neutral

- No hay enforcement automático. Una import "ilegal" (Card → otra Card)
  pasaría linting. Podría agregarse ESLint rule en futuro.

## Implementation

La estructura ya está implementada en Lote 1:

```
src/components/
├── shell/                  ← chrome del producto (ModuleBar, Sidebar, Topbar)
│                              · capa transversal, fuera del stack normal
└── maxtracker/             ← stack del producto
    ├── KpiTile.tsx              capa 2
    ├── StatusPill.tsx           capa 2
    ├── SectionHeader.tsx        capa 2
    ├── Tabs.tsx                 capa 2
    ├── LeafletMap.tsx           capa 2
    ├── AlarmCard.tsx            capa 3
    ├── DriverScoreCard.tsx      capa 3
    ├── AssetEventCard.tsx       capa 3
    ├── EventRow.tsx             capa 3
    ├── AssetTable.tsx           capa 4
    ├── SortHeader.tsx           capa 4
    ├── Pagination.tsx           capa 4
    ├── AssetFilterBar.tsx       capa 4
    └── AssetHeader.tsx          capa 5
```

Documentado también en `docs/design-system/DOC-10-design-system.md` §4.

## Cuándo violar este ADR

Una capa "salta" otra solo si:
- Hay un caso de uso real que no se reduce a composición de capas
  inferiores
- La excepción se documenta inline en el archivo afectado
- Si la excepción se repite > 2 veces, se replantea el ADR
