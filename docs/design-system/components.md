# DOC-10 · Component Catalog

> Sub-documento del Design System.
> 15 componentes producidos en Lote 1, organizados por capa.
> Cada entrada documenta: propósito · anatomía · API · variantes · comportamiento · referencia al código.

---

## Índice

| Capa | Componentes |
|---|---|
| **Primitives & layout** | [KpiTile](#kpitile) · [StatusPill](#statuspill) · [SectionHeader](#sectionheader) · [Tabs](#tabs) · [LeafletMap](#leafletmap) |
| **Cards** | [AlarmCard](#alarmcard) · [DriverScoreCard](#driverscorecard) · [AssetEventCard](#asseteventcard) · [EventRow](#eventrow) |
| **Lists & tables** | [AssetTable](#assettable) · [SortHeader](#sortheader) · [Pagination](#pagination) · [AssetFilterBar](#assetfilterbar) |
| **Composites** | [AssetHeader](#assetheader) |

Convenciones de esta sección:

- **Anatomía** describe la estructura visual del componente
- **Props** lista todas las propiedades de la interfaz pública
- **Variantes** enumera los modos visuales/funcionales del componente
- **Comportamiento** describe interacciones (hover, click, navegación)
- **Notas** documenta gotchas y decisiones técnicas
- **Referencia** apunta al archivo de código

---

# Primitives & layout

## KpiTile

Tile rectangular para mostrar una métrica top-line. Es el bloque atómico
del KPI strip que aparece en Patrones A, B y D.

### Anatomía

```
┌─────────────────────────┐
│  18                     │  ← value (mono, --fs-kpi/2)
│  ALARMAS ACTIVAS        │  ← label (uppercase, --fs-label)
│  Requieren atención     │  ← caption (opcional, --fs-card-meta)
└─────────────────────────┘
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `label` | `string` | (req) | Etiqueta uppercase debajo del valor |
| `value` | `string \| number` | (req) | Valor principal mostrado en grande |
| `accent` | `"red" \| "grn" \| "amb" \| "blu"` | `undefined` | Tinte semántico aplicado al valor |
| `caption` | `string` | `undefined` | Texto pequeño aclaratorio debajo del label |

### Variantes

| Variante | Cuándo usar | Color del valor |
|---|---|---|
| Sin accent | Métrica neutra (Total, Eventos 24h informativo) | `--tx` (negro) |
| `accent="red"` | Métrica que indica problema (Alarmas activas > 0) | `--red-dark` |
| `accent="amb"` | Métrica de caución (Eventos elevados, Mantenimiento > 0) | `--ora-t` |
| `accent="grn"` | Métrica saludable (Score ≥ 80, problemas en 0) | `--grn` |
| `accent="blu"` | Métrica neutra-positiva (Detenidos OK) | `--blu-t` |

### Lógica de selección de accent (Dashboard D)

```
Alarmas activas:        red si > 0, grn si == 0
Assets críticos:        red si > 0, grn si == 0
Eventos 24h:            siempre amb (informativo)
Safety score flota:     grn si ≥ 80, amb si 60-79, red si < 60
```

### Notas

- El value es siempre `--m` mono. Los números pasan por `formatNumber()`
  cuando son grandes (>= 1000) para usar separadores `es-AR`.
- El tile tiene `min-width: 0` interno para evitar overflow en grid contexts.
- En el KPI strip de cada página se aplica `minmax(MIN, MAX)` al grid
  para que los tiles no se estiren a anchos absurdos. Ver tokens.md §4.3.

### Referencia

- `src/components/maxtracker/KpiTile.tsx`
- `src/components/maxtracker/KpiTile.module.css`

---

## StatusPill

Pill coloreada que representa el estado operativo de un Asset.

### Anatomía

```
┌──────────────────────┐
│ ● En movimiento      │  ← dot + label
└──────────────────────┘
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `status` | `AssetStatus` | (req) | Uno de los 5 estados del enum |
| `showDot` | `boolean` | `true` | Si false, oculta el dot inicial |

### Variantes

Una variante por cada `AssetStatus`:

| Status | Color base | Background | Significado |
|---|---|---|---|
| `MOVING` | `--grn` | `--grn-bg` | Operacional + dinámico |
| `IDLE` | `--blu` | `--blu-bg` | Operacional + estático |
| `STOPPED` | `--t3` | `--sf2` | Detención prolongada · neutro |
| `OFFLINE` | `--red` | `--red-bg` | Sin comunicación con el device |
| `MAINTENANCE` | `--ora` | `--ora-bg` | Fuera de servicio programado |

### Notas

- El label se traduce vía `ASSET_STATUS_LABEL` en `src/lib/format.ts`.
- `showDot={false}` se usa cuando StatusPill aparece dentro de un contexto
  que ya tiene un dot propio (raro, pero existe el opt-out).
- El padding y radio son fijos — no es configurable de tamaño porque solo
  se usa inline en filas de tabla y cards.

### Referencia

- `src/components/maxtracker/StatusPill.tsx`
- `src/components/maxtracker/StatusPill.module.css`

---

## SectionHeader

Encabezado de sección dentro de una página. Uppercase, restrained, con
contador opcional.

### Anatomía

```
ALARMAS ABIERTAS  18                         [opcional: action]
─────────────────
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `title` | `string` | (req) | Texto uppercase del título |
| `count` | `number` | `undefined` | Badge numérico al lado del título |
| `action` | `ReactNode` | `undefined` | Slot derecho para acciones (link "Ver todas", botón filtro, etc.) |

### Variantes

| Variante | Cuándo usar |
|---|---|
| Solo título | Secciones simples sin contador |
| Título + count | Cuando el contador agrega contexto inmediato (alarmas abiertas) |
| Título + action | Cuando hay un CTA contextual ("Ver todas", "Exportar") |

### Notas

- No es un h2 semántico — usa `<h2>` internamente pero los estilos no
  reflejan el peso de un h2 tradicional. Es deliberado: las secciones
  dentro de una página no deben competir con el h1 del header.
- `count` se renderiza como badge gris neutro. Si necesitás un badge
  semántico (rojo para "críticas"), customizá inline con un span propio.

### Referencia

- `src/components/maxtracker/SectionHeader.tsx`
- `src/components/maxtracker/SectionHeader.module.css`

---

## Tabs

Barra horizontal de tabs con state persistido en URL como `?tab=...`.

### Anatomía

```
[Overview]  Histórico   Alarmas 12  Eventos    Persona  Devices
─────────                ────────
```

(El tab activo lleva subrayado rojo de 2px alineado con el border-bottom de
la barra. Tabs disabled aparecen con opacity reducida y cursor not-allowed.)

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `basePath` | `string` | (req) | Path sin query string para construir hrefs |
| `tabs` | `TabDef[]` | (req) | Array de definiciones de tabs |
| `active` | `string` | (req) | Key del tab actualmente activo |

### `TabDef` interface

```ts
interface TabDef {
  key: string;
  label: string;
  count?: number;
  disabled?: boolean;
}
```

### Comportamiento

- Cada tab no-disabled es un `<Link>` con `scroll={false}` (no hace
  scroll-to-top al cambiar tab).
- El primer tab usa el basePath sin query (URL canónica del default).
- Los demás tabs agregan `?tab=<key>`.
- Tabs disabled renderizan como `<span>` muted, no clickeables.
- El subrayado del tab activo está alineado con el border-bottom de la
  barra mediante `margin-bottom: -1px` y `border-bottom-width: 2px`.

### Notas

- El componente NO derivar `active` automáticamente del URL — la página
  contenedora debe pasarlo explícitamente. Esto permite que la página
  use Server Components y haga sus propios fetches según el tab activo.
- `count` se muestra como badge integrado al label. Si el tab está
  activo, el badge cambia de gris (`--sf2`) a rojo claro (`--red-bg`).

### Referencia

- `src/components/maxtracker/Tabs.tsx`
- `src/components/maxtracker/Tabs.module.css`

---

## LeafletMap

Wrapper Client component sobre `react-leaflet` con dynamic import para
evitar SSR issues. Renderiza un mapa OSM con un único marker.

### Anatomía

```
┌────────────────────────────────────┐
│                                    │
│     [tiles OSM]                    │
│                                    │
│         📍 (marker)                │
│                                    │
└────────────────────────────────────┘
  © OpenStreetMap contributors
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `lat` | `number` | (req) | Latitud del marker |
| `lng` | `number` | (req) | Longitud del marker |
| `zoom` | `number` | `13` | Zoom inicial (1-19) |
| `popupContent` | `ReactNode` | `undefined` | Si presente, click al marker abre popup |

### Comportamiento

1. **Dynamic import:** la lib se carga solo en cliente. Mientras carga,
   muestra "Cargando mapa…" con fondo `--map-bg`.
2. **Resize on mount:** `requestAnimationFrame` + `setTimeout(300ms)` para
   llamar `invalidateSize(true)` después que el contenedor flex termine
   de calcular su tamaño. Sin esto, los tiles renderizan a 0×0 hasta
   primera interacción.
3. **Marker icons:** los íconos default de Leaflet vienen rotos en
   bundlers como webpack. El wrapper provee URLs absolutas a unpkg.com
   para `marker-icon.png`, `marker-icon-2x.png`, `marker-shadow.png`.

### Variantes de zoom (convención de uso)

| `mobilityType` del Asset | Zoom recomendado |
|---|---|
| `MOBILE` (vehículo en ruta) | `13` (cuadras de ciudad legibles) |
| `FIXED` (silo, máquina fija) | `16` (edificio individual visible) |

### Notas

- **Scroll-wheel zoom desactivado** por default (`scrollWheelZoom={false}`)
  para evitar que el mapa "robe" el scroll de la página.
- El wrap tiene `min-height: 280px` y `border: 1px solid var(--brd)`.
- En Lote 1 el mapa muestra solo un marker. Multi-marker (lista de assets,
  trayectoria de un viaje) llega en Lotes 2/3.

### Referencia

- `src/components/maxtracker/LeafletMap.tsx` (wrapper público)
- `src/components/maxtracker/LeafletMapInner.tsx` (renderer real)
- `src/components/maxtracker/LeafletMap.module.css`

---

# Cards

## AlarmCard

Card clickeable que representa una alarma. Navega a Libro B del asset al
hacer click.

### Anatomía

```
┌─────────────────────────────────────────────────────────────┐
│ ●  Conducción brusca  CRÍTICA                          ›    │
│    Camión 023 · AE 747 HO                                   │
│    👤 Cloyd Schultz · 🕐 hace 3d                            │
└─────────────────────────────────────────────────────────────┘
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `alarm` | `AlarmWithRefs` | (req) | Alarma enriquecida con asset + person |

### Variantes (por severidad)

| Severity | Visual cue |
|---|---|
| `LOW` | Dot azul, severity tag azul |
| `MEDIUM` | Dot ámbar, severity tag ámbar |
| `HIGH` | Dot ámbar con halo, **borde lateral izquierdo ámbar 2px** |
| `CRITICAL` | Dot rojo con halo, **borde lateral izquierdo rojo 2px** |

### Comportamiento

- **Toda la card es un Link** al `/seguridad/assets/${alarm.assetId}`.
- Hover: background → `--bg`, border → `--brd2`, chevron se desplaza 2px.
- Cmd-click abre en nueva pestaña (semántica HTML respetada).

### Estados de driver

Tres casos manejados:

| Caso | Render |
|---|---|
| Hay driver | `User-icon · Cloyd Schultz · Clock-icon · hace 3d` |
| Sin driver | `User-icon · Sin conductor asignado (italic) · Clock-icon · hace 3d` |
| Driver null sin info | (no se muestra User-icon ni nombre, solo timestamp) |

> **Decisión Sub-lote 1.6 (DEUDA-1.3-V04):** uniformamos el formato así
> el ojo siempre encuentra el timestamp en el mismo lugar. La italic en
> "Sin conductor asignado" señala "metadata ausente" sin romper el ritmo.

### Referencia

- `src/components/maxtracker/AlarmCard.tsx`
- `src/components/maxtracker/AlarmCard.module.css`

---

## DriverScoreCard

Card compacta para la leaderboard de "peores conductores" del Dashboard D.

### Anatomía

```
┌──────────────────────────────────────────┐
│ [CS]  Cloyd Schultz                      │
│       ████████████░░░░░░░░░░░  56        │
│       6 eventos · 30d                     │
└──────────────────────────────────────────┘
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `driver` | `DriverScoreRow` | (req) | Conductor + count de eventos 30d |

### Variantes (por banda de score)

| Score | Color de barra + número |
|---|---|
| < 60 | Rojo (`--red`) |
| 60-79 | Ámbar (`--ora`) |
| ≥ 80 | Verde (`--grn`) |

### Comportamiento

- **No es clickeable** en Lote 1. En Lote 2+ se conectará a un perfil del
  conductor (Persona tab del asset, o ruta dedicada `/seguridad/personas/[id]`).
- La barra tiene un track (`--brd2` con borde) claramente visible para
  que el "porcentaje vacío" lea como espacio restante hasta 100, no como
  fondo de la card. Esto fue fix de Sub-lote 1.6 (DEUDA-1.3-V03).

### Notas

- El avatar muestra iniciales (firstName[0] + lastName[0]) sobre fondo
  `--dark`. Las fotos de conductor llegan en Lote 4+.
- El score es un valor estático en el seed. En producción, la KpiDailySnapshot
  recalculará score diariamente.

### Referencia

- `src/components/maxtracker/DriverScoreCard.tsx`
- `src/components/maxtracker/DriverScoreCard.module.css`

---

## AssetEventCard

Card minimal que representa "un asset y su número de eventos" en el panel
"Top 5 assets · más eventos" del Dashboard D.

### Anatomía

```
┌──────────────────────────────────────────┐
│  Camión 023                       7      │
│  AE 747 HO                       EVENTOS  ›│
└──────────────────────────────────────────┘
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `asset` | `AssetEventCountRow` | (req) | Asset + count de eventos 30d |

### Comportamiento

- Toda la card es Link a Libro B.
- Hover: chevron se desplaza, background cambia.
- El número de eventos es el "headline" — domina visualmente sobre el
  nombre del asset.

### Notas

- Es la card más minimal del sistema. Se quería evitar que el panel
  "Top 5" se sintiera redundante con la lista de alarmas. La estructura
  `[name + plate]   [count + label]   [chevron]` lo logra.

### Referencia

- `src/components/maxtracker/AssetEventCard.tsx`
- `src/components/maxtracker/AssetEventCard.module.css`

---

## EventRow

Row compacta no-clickeable para listas de eventos dentro de Libro B.

### Anatomía

```
┌──────────────────────────────────────────────────┐
│ ●  Frenado brusco  HIGH                          │
│    👤 Cloyd Schultz · 🕐 hace 2h · 89 km/h       │
└──────────────────────────────────────────────────┘
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `event` | `EventWithPerson` | (req) | Evento enriquecido con person |

### Variantes

Igual estructura de severity que AlarmCard:

| Severity | Visual cue |
|---|---|
| `LOW` | Dot azul |
| `MEDIUM` | Dot ámbar |
| `HIGH` | Dot ámbar con halo |
| `CRITICAL` | Dot rojo con halo + borde lateral izquierdo rojo |

### Diferencias vs AlarmCard

| Aspecto | EventRow | AlarmCard |
|---|---|---|
| Clickeable | No | Sí |
| Estructura | 2 líneas | 3 líneas |
| Chevron | No | Sí |
| Severity tag | Inline en línea 1 | Inline en línea 1 |
| Borde lateral | Solo CRITICAL | HIGH + CRITICAL |
| Speed metadata | Sí (cuando aplica) | No |

EventRow es más liviana porque el evento es **información**, no un
artefacto que requiera acción. Para "ir a investigar" un evento, ya
estás en el contexto del asset.

### Referencia

- `src/components/maxtracker/EventRow.tsx`
- `src/components/maxtracker/EventRow.module.css`

---

# Lists & tables

## AssetTable

Tabla principal de Patrón A (Lista de Assets). Toda fila clickeable.

### Anatomía

```
┌──────────┬─────────┬─────────┬──────────┬──────────┬───────┬───┐
│ Asset ↑  │ Patente │ Grupo   │ Conductor│ Estado ↑ │ Score │   │
├──────────┼─────────┼─────────┼──────────┼──────────┼───────┼───┤
│ Camión   │AE 747 HO│Larga d. │Cloyd S.  │● Moving  │  56   │ › │
│  Mercedes│         │         │          │          │ (red) │   │
├──────────┼─────────┼─────────┼──────────┼──────────┼───────┼───┤
│ ...                                                            │
└────────────────────────────────────────────────────────────────┘
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `rows` | `AssetListRow[]` | (req) | Filas a renderizar (ya paginadas) |
| `current` | `AssetsSearchParams` | (req) | Estado actual de URL para construir links |

### Anatomía de fila

Cada `<tr>` se divide en 7 celdas, cada una un `<td>` que contiene un
`<Link>` que ocupa toda la celda:

| # | Celda | Contenido |
|---|---|---|
| 1 | Asset | name (--fs-card-title) + make/model (--fs-card-meta) |
| 2 | Patente | mono (--m, --fs-body) |
| 3 | Grupo | dim (--t3) |
| 4 | Conductor | nombre completo o "—" |
| 5 | Estado | StatusPill |
| 6 | Score | Badge tinted (rojo/ámbar/verde) o "—" si sin driver |
| 7 | Chevron | Icon ChevronRight (--t3, animado en hover) |

### Comportamiento

- **Toda la fila es clickeable** — cada celda envuelve su contenido en
  un `<Link>`. Cmd-click abre en nueva pestaña.
- **Por qué no `<tr onClick>`:** rompe semántica HTML, pierde el
  comportamiento native de Cmd-click, y dificulta accesibilidad.
- Hover: `tr` cambia background a `--bg`, chevron se desplaza 2px.
- Sort lo maneja [SortHeader](#sortheader).

### Empty state

Si `rows.length === 0`, renderiza:

```
┌──────────────────────────────────────────────────┐
│   No hay assets que cumplan los filtros          │
│   aplicados.                                     │
└──────────────────────────────────────────────────┘
```

(Border dashed en `--brd`, padding generoso, font-family mono.)

### Notas

- En Lote 1 las columnas son fijas. Customización del orden/visibilidad
  llega en Lote 2+ con vistas guardadas.
- El score badge tiene `border` además de background para reforzar la
  pertenencia a una banda incluso sobre fondos hover.

### Referencia

- `src/components/maxtracker/AssetTable.tsx`
- `src/components/maxtracker/AssetTable.module.css`

---

## SortHeader

Header `<th>` clickeable que emite Links con `sort` y `dir` overrides.

### Anatomía

```
ASSET ↑   ← activo, asc, flechita roja
ESTADO    ← inactivo, hover muestra ↑↓ tenue
SCORE ↓   ← activo, desc, flechita roja apuntando abajo
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `field` | `SortField \| null` | (req) | Campo de sort, o `null` para columna no sortable |
| `label` | `string` | (req) | Texto de la columna |
| `current` | `AssetsSearchParams` | (req) | Estado actual de URL |
| `align` | `"left" \| "right"` | `"left"` | Alineación |

### Comportamiento

- Click en columna inactiva → sort por esa columna en `asc`
- Click en columna activa → flip `dir` (asc ↔ desc)
- Si `field === null`, renderiza como th plain sin Link

### Notas

- Es un Server Component (no necesita state local). Cada click es una
  navegación SSR completa, lo cual es OK porque el dataset es chico
  (80 assets). Para datasets grandes esto se reemplaza por client-side
  re-fetch.

### Referencia

- `src/components/maxtracker/SortHeader.tsx`
- `src/components/maxtracker/SortHeader.module.css`

---

## Pagination

Paginación inferior con prev/next + numbered pages + summary.

### Anatomía

```
Mostrando 1–25 de 80               ← prev   1 2 3 4   next →
                                      ▔▔▔▔▔
                                       (page 1 active, dark)
```

Con elipsis cuando hay muchas páginas:

```
                                   ← prev   1 ... 7 8 9 ... 12   next →
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `total` | `number` | (req) | Total de items |
| `page` | `number` | (req) | Página actual |
| `pageSize` | `number` | (req) | Items por página |
| `pageCount` | `number` | (req) | Total de páginas |
| `current` | `AssetsSearchParams` | (req) | Estado actual de URL |

### Algoritmo de page numbers

```
si pageCount ≤ 7  → mostrar todas las páginas
de lo contrario:
  · siempre incluir 1 y pageCount
  · incluir current ± 1
  · "..." entre gaps
```

### Comportamiento

- prev/next deshabilitados en bordes (renderizados como `<span>` no como
  `<a>`).
- Click en una página → navegar manteniendo todos los demás query params.
- Si `total === 0`, no se renderiza nada.

### Referencia

- `src/components/maxtracker/Pagination.tsx`
- `src/components/maxtracker/Pagination.module.css`

---

## AssetFilterBar

Barra de filtros con search input + 4 select dropdowns + clear-all link.

### Anatomía

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 Buscar por nombre o patente…  Cuenta: Todos  Grupo: Todos  ...    │
│                                                            ✕ Limpiar │
└──────────────────────────────────────────────────────────────────────┘
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `current` | `AssetsSearchParams` | (req) | Estado actual de URL |
| `accounts` | `{id, name}[]` | (req) | Opciones del dropdown Cuenta |
| `groups` | `{id, name, accountId}[]` | (req) | Opciones del dropdown Grupo |

### Comportamiento

- **Search:**
  - controlled input (state local)
  - commitea on Enter o on blur (NO en cada keystroke, evita thrash de URL)
  - botón ✕ inline para limpiar
- **Cuenta:** native `<select>` styled como pill
  - Al cambiar Cuenta, el filtro Grupo se resetea
- **Grupo:** native `<select>` styled como pill
  - Si Cuenta está activo, solo muestra grupos de ese account
- **Estado / Movilidad:** native `<select>` styled como pill
- **Limpiar filtros:** Link `/seguridad/assets` plain, solo aparece si hay
  algún filtro activo

### Por qué native `<select>`

Custom dropdowns aportan poco vs lo que cuestan en accesibilidad,
mobile-friendliness y mantenimiento. Los `<select>` nativos:

- Funcionan en mobile (picker del SO)
- Son keyboard-accessible nativo
- Soportan voiceover/screenreader sin trabajo
- Son cero JS

El styling pill se logra con un wrapper `<label>` y un `appearance: none`
en el select, manteniendo el comportamiento nativo intacto.

### Variantes visuales del select

| Estado | Visual |
|---|---|
| Sin filtro activo | Background `--bg`, label gris claro |
| Con filtro activo | Background `--dark`, texto blanco |

El cambio de variante hace evidente sin necesidad de leer cuáles filtros
están aplicados.

### Notas

- Es un **Client Component** (única excepción de Lote 1) porque necesita
  state local del search input y `useRouter` para navigate.
- `useTransition` se usa para envolver los `router.push` y mantener la
  UI responsiva mientras Next.js re-renderiza la página.

### Referencia

- `src/components/maxtracker/AssetFilterBar.tsx`
- `src/components/maxtracker/AssetFilterBar.module.css`

---

# Composites

## AssetHeader

Header completo del Libro B (Patrón B). Combina back-link, identidad del
asset, status, última señal, y meta-info en una sola unidad.

### Anatomía

```
‹ Volver al Dashboard

Camión 023                                    ● En movimiento
AE 747 HO · Mercedes Actros 2645 · 2022       Última señal · hace 3 min

🏢 Cuenta: Transportes del Sur SA   Layers Grupo: Larga distancia   👤 Conductor: Cloyd Schultz   📍 Posición: -34.6037, -58.3816
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `asset` | `AssetDetail` | (req) | Asset detail completo (con account, group, currentDriver, lastPosition) |

### Estructura visual

| Sección | Contenido |
|---|---|
| **Back link** | Link a `/seguridad` con chevron-left |
| **Title row** (flex space-between) | Izquierda: nombre + subtitle (plate · make/model · year) · Derecha: StatusPill + última señal relativa |
| **Meta row** | Chips horizontales con icon + label + value: Cuenta, Grupo, Conductor, Coordenadas |

### Variantes

No tiene variantes propias. Adapta su contenido según los datos del asset:

| Caso | Adaptación |
|---|---|
| Asset sin `currentDriver` | Conductor → "Sin asignar" |
| Asset sin `group` | Grupo → "Sin grupo" |
| Asset sin `lastPosition` | No se muestra "Última señal" ni Coordenadas |
| Asset sin `make`/`model` | Subtitle se compone solo con plate y year |

### Notas

- El border-bottom del header separa visualmente del contenido del tab.
- El padding bottom es `16px` (literal, no token) porque crea el espacio
  preciso entre el header y los KPI tiles que vienen abajo.

### Referencia

- `src/components/maxtracker/AssetHeader.tsx`
- `src/components/maxtracker/AssetHeader.module.css`

---

# Apéndice

## Componentes futuros previstos

Lo que falta para considerar el sistema "completo enterprise" y en qué lote
llegará:

| Componente | Lote estimado | Para qué |
|---|---|---|
| `Modal` / `Dialog` | 2.x | Confirmaciones (cerrar alarma, eliminar zona) |
| `Drawer` | 2.x | Panel lateral de detalle (alarma sin navegar) |
| `Toast` | 2.x | Feedback de acciones (alarma cerrada, exportación lista) |
| `Skeleton` | 2.x | Loading states de listas |
| `EmptyState` (genérico) | 2.x | Reemplazo de los empties inline actuales |
| `TextInput`, `Textarea` | 2.x | Forms (crear zona, editar asset) |
| `DatePicker`, `DateRange` | 3.x | Selector de período del topbar |
| `Combobox` (multi-select) | 3.x | Filtros multi-valor avanzados |
| `Chart` (line, bar, donut) | 3.x | Patrón C (Boletines) y dashboards extendidos |
| `Tooltip` | 2.x | Help inline sobre acrónimos del dominio |
| `Avatar` (con foto) | 4.x | Cuando agreguemos fotos de drivers |
| `Breadcrumb` (dinámico) | 2.x | Reemplazo del breadcrumb hardcoded del topbar |

## Componentes excluidos del sistema

Patrones de UI moderna que no vamos a implementar a menos que aparezca un
caso de uso fuerte:

- **Carousel/slider** (no aplica al dominio)
- **Stepper/wizard** (preferimos tabs o flujos lineales explícitos)
- **Drag-and-drop kanban** (no es un patrón de Maxtracker, salvo que
  Operaciones lo justifique)
- **Notification center popover** (la campanita es decorativa hoy, en
  Lote 4 será solo un link a `/notifications`)

## Lecciones aprendidas

Algunas cosas que detectamos durante Lote 1 y que quedan documentadas
como guía para futuros lotes:

1. **El padding interno de cards es la decisión que más afecta consistencia
   visual.** Variar 8/10/12 entre componentes hace que el sistema "respire"
   diferente. Por eso `--pad-card` es token, no literal.

2. **Los chevrons animados al hacer hover** mejoran percepción de "esto es
   navegable" sin agregar copy. Patrón replicable en cualquier link de
   lista futura.

3. **Severity con dot + borde lateral redundante** sobrevive al daltonismo
   y al print blanco-y-negro. Mantener este pattern.

4. **URL state para filtros y tabs** elimina toda una clase de bugs (refresh
   pierde estado, share no funciona). Adoptarlo desde el inicio en cualquier
   nueva pantalla de Lote 2+.

5. **Native `<select>` styled como pill** demostró que custom dropdowns
   eran innecesarios. Resistir la tentación cuando aparezca el primer
   request de "necesito algo más fancy".
