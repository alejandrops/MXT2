# Bloques compartidos · Maxtracker

> Este documento define los bloques de UI que se usan en toda la
> aplicación. Cualquier mejora a un bloque se propaga automáticamente
> a cada lugar que lo usa.
>
> **Regla base**: si un bloque aparece en más de una pantalla, NO se
> duplica · vive en `/src/components/maxtracker/` y todos los lugares
> lo importan. Cualquier desviación necesita justificación explícita
> en un ADR.
>
> **Estado**: vivo · se actualiza con cada lote.

---

## 1. `<DetailBlocks>` · Panel de detalle (cajas label·valor)

**Archivo**: `src/components/maxtracker/DetailBlocks.tsx`

**Bloques que expone**:

```
PanelShell        · contenedor exterior con borde y scroll
SectionHeader     · barra de título "ESTADO" / "TELEMETRÍA" / etc.
Row               · fila label · valor con accent opcional
Rows              · contenedor flex column de Rows (separadores)
Num · Unit        · primitivos para valores numéricos
Dot               · indicador binario on/off (verde/gris)
CommDot           · dot coloreado por estado de comunicación
CoordRow          · fila lat o lng con formato monoespaciado
DriverCard        · card del conductor asignado
PlaceholderHint   · texto en cursiva para placeholders
```

**Helpers**:

```
speedAccent(speed)        → accent CSS para velocidades altas
degToCardinal(deg)        → "N", "NNE", "NE", ...
commLabel(msAgo)          → "hace 2 min", "hace 1 h", ...
```

**Dónde se usa**:
- `AssetDetailPanel` · panel derecho de `/seguimiento/mapa`
- `TelemetryPanel` · panel derecho de `/seguimiento/historial`
- (futuro) panel de detalle en `/gestion/vehiculos/[id]` tab Mapa
- (futuro) modales de "ver más" del listado

**Regla de oro**: si una pantalla nueva muestra info de un activo en
sidebar derecho, usa `<PanelShell>` + `<SectionHeader>` + `<Row>`.
Nunca redefinir SectionHeader localmente.

---

## 2. `<VehicleSelector>` · Selector universal de vehículos

**Estado actual**: parcialmente unificado · hay 3 implementaciones
(`TripsFilterBar`, `FleetFilterBar`, `VehicleSelectorModal`).

**Decisión**: extraer un componente único `VehicleSelector` que
acepte todos los modos en uno.

**Modos**:

```
TODOS         · default · sin selección activa = toda la flota
GRUPOS        · 1+ grupos · activos en AND con filtros
INDIVIDUALES  · 1+ assets · activos en AND con filtros
COMBINADO     · TODOS / GRUPOS / INDIVIDUALES juntos
```

**API** (objetivo):

```tsx
<VehicleSelector
  mode="combined"            // o "groups-only", "assets-only"
  groups={groups}            // opcional · si no se pasa, se infiere
  assets={assets}
  selectedGroupIds={[]}
  selectedAssetIds={[]}
  onChange={(g, a) => ...}
  showSummary                // "Mostrando X de Y"
/>
```

**UX consistente** entre todas las apariciones:
- Multi-select con búsqueda interna
- Botón con label `Vehículos: 3 vehículos`
- Limpiar por picker + Limpiar global
- Estado activo con borde + fondo azul leve
- Dropdown con max-height + scroll

**Dónde se usa hoy**:
- `/seguimiento/mapa` (FleetFilterBar)
- `/seguimiento/viajes` (TripsFilterBar)
- `/seguimiento/mapa` modal multi-mapa (VehicleSelectorModal)

**Dónde se usará**:
- Cualquier reporte que filtre por vehículo
- `/gestion/vehiculos` listado (cuando reemplacemos AssetFilterBar)
- Filtros de eventos / alarmas

---

## 3. `<MapLayerToggle>` · Selector de capa del mapa

**Archivo**: `src/components/maxtracker/MapLayerToggle.tsx`

**Forma**: botón compacto in-map · esquina superior derecha del mapa.

**Capas**: `STANDARD` · `BW` · `SATELLITE` (definidas en `mapTileSources.ts`).

**Regla**: NUNCA fuera del mapa. Siempre absolutamente posicionado
sobre el mapa (top-right). El usuario asocia "capas" con el mapa
mismo, no con la página.

**Dónde se usa**:
- `/seguimiento/mapa` (in-map)
- `/seguimiento/viajes` (in-map · TripsClient)

**Dónde se debe agregar**:
- `/seguimiento/historial` (RoutePlayback) ← E3b
- `/gestion/vehiculos/[id]` tab Mapa ← E5
- Multi-mapa · sobre la grid

**Persistencia**: cada surface guarda su preferencia en
`localStorage` con key `<surface>-map-layer` (ej. `trips-map-layer`,
`historial-map-layer`).

---

## 4. `<MapViewToggle>` · Toggle vista única vs mosaico

**Reemplaza**: `GridLayoutToggle` (botón con tamaños 1, 2×2, 2×3,
3×3) que era confuso.

**Forma nueva**:

```
┌──────────────┬──────────────┐
│  Vista única │   Mosaico    │
│      ☐       │      ☑       │
└──────────────┴──────────────┘
```

Toggle binario con dos botones. El icono de Mosaico (2×2) está
SIEMPRE visible · el usuario sabe siempre dónde encontrarlo.

Cuando el usuario activa "Mosaico", aparece a la derecha un
selector de layout `2×2 / 2×3 / 3×3 / 4×4`.

**Donde vive**: solo en `/seguimiento/mapa` (no se usa en otros
lugares).

---

## 5. `<AssetCard>` · Ficha resumen del vehículo

**Estado actual**: no existe como componente unificado. Cada
listado/sidebar repinta su propia versión.

**Forma propuesta** (a implementar gradualmente):

```
┌─────────────────────────────────────────────────┐
│  ●  Camión AG222            AB456RM         ▶   │
│     Volkswagen · Constellation                  │
│     ● Apagado · hace 12 min                     │
│     👤 Carlos Pérez                              │
└─────────────────────────────────────────────────┘
```

Variantes:
- `compact` · solo nombre + patente + estado (lista densa)
- `full` · agrega marca/modelo + conductor (sidebar)
- `linked` · todo el card es `<Link>` al detalle

**Dónde se usa** (objetivo):
- `FleetSidebar` (lista derecha del mapa)
- Hover de marker en el mapa
- Tooltips en histogramas/heatmaps
- Lista de "vehículos involucrados" en reportes

---

## 6. `<PersonCard>` · Ficha resumen del conductor

Mismo patrón que `AssetCard`, para conductores.

```
┌─────────────────────────────────────────────────┐
│  CP  Carlos Pérez                          ▶   │
│      DNI 28.456.789                             │
│      Score 87 · 1.245 km esta semana           │
└─────────────────────────────────────────────────┘
```

Variantes:
- `compact` · avatar + nombre + score
- `full` · agrega DNI + km/tiempo + último viaje
- `linked` · todo el card es `<Link>` al detalle del chofer

---

## 7. Iconografía coherente

**Decisión**: el ícono de "Dashboard" en el sidebar debe ser SIEMPRE
el mismo (barras de gráfico) en todas las áreas:
- Conducción → Dashboard (`s-sf`)
- Dirección → Vista ejecutiva (`s-cl`)
- Seguridad → Dashboard
- Cualquier dashboard futuro

**Decisión**: el ícono de capa de mapa es siempre el de
`Layers` de lucide-react.

---

## 8. Convenciones de filtros

Cualquier filter bar de listado largo (vehículos, conductores,
viajes, eventos, alarmas) debe seguir estas reglas:

1. **URL-driven** cuando el listado es compartible · estado en URL
2. **Estado local** cuando es vista live (mapa principal)
3. Multi-select tiene **siempre** búsqueda interna
4. Multi-select tiene **siempre** limpiar individual + global
5. Indicador visual de "filtros activos" (borde + fondo azul leve)
6. Summary "Mostrando X de Y" cuando hay un total significativo

---

## Próximos pasos

Estas son cosas que se identificaron pero requieren su propio lote:

- [ ] Extraer `VehicleSelector` del trío actual (TripsFilterBar +
      FleetFilterBar + VehicleSelectorModal). Lote dedicado.
- [ ] Crear `<AssetCard>` y migrar el row del FleetSidebar a usarlo.
- [ ] Crear `<PersonCard>` para los listados de conductores.
- [ ] Cubrir tests visuales (Storybook o similar) para los bloques
      compartidos.
- [ ] Cuando el schema agregue per-trip driver, simplificar
      `getDriverAssetHistory` (hoy atribuye trips a chofer vía
      overlap de eventos · ver comentario en el archivo).

---

## N. `<DriverAssetHistoryPanel>` · Histórico de conductores por vehículo

**Archivo**: `src/components/maxtracker/DriverAssetHistoryPanel.tsx`

**Qué es**: panel que lista los conductores que pasaron por un
vehículo en las últimas 12 semanas, con stats de uso (viajes, km,
tiempo al volante, días) y un mini-heatmap GitHub-style por
chofer. Cada card es un Link al 360 del conductor; el conductor
actualmente asignado se pinea arriba con un pill "Actual".

**Data shape**: viene de `getDriverAssetHistory(assetId)` en
`@/lib/queries/driver-asset-history`. La atribución de trips a
chofer es heurística (overlap de eventos con personId dentro de
la ventana del trip · fallback al currentDriver). Esta heurística
queda obsoleta el día que el schema agregue `Trip.personId`.

**Dónde se usa**:

- `/gestion/vehiculos/[id]?tab=persona` (Lote E5 · C)
- (futuro) reutilizable en `/gestion/conductores/[id]` con
  inversión de eje (vehículos que el chofer usó)

**Contrato visual**:

```
[Avatar]  Nombre Apellido  [Actual]  [Score 78]
                                                         42 viajes · 1.240 km · 45h 30m · 18 días
                                                         ████░░░██░██░ ... 84-day heatmap
                                                         "Última actividad hace 2 días"  →
```

**Reglas de oro**:

- El heatmap usa la misma rampa cyan que `<ActivityHeatmap>` para
  coherencia visual cross-page.
- El score pill usa los tokens semánticos `--grn-*` / `--ora-*` /
  `--red-*` (no inventar otros).
- La altura del card debe absorber 7 filas de heatmap (8px) +
  caption · ~84px en desktop, fluye a stack en <1100px.

---

## O. `<AssetRouteMap>` · Mini route map con SSR-safe wrapper

**Archivo**: `src/components/maxtracker/AssetRouteMap.tsx`

**Qué es**: wrapper público sobre `AssetMiniMap` que aplica el
mismo patrón que `<LeafletMap>`: dynamic import con `ssr:false`
para que páginas server puedan importarlo sin pull de leaflet en
el SSR pass.

**Por qué existe**: `AssetMiniMap` ya hace el render de la
polyline y los markers de inicio/fin, pero como es `"use client"`
con dependencias leaflet, importarlo desde un Server Component
sin wrapper rompe el build. `AssetRouteMap` resuelve eso.

**Dónde se usa**:

- `/gestion/vehiculos/[id]?tab=overview` (Lote E5 · E)
- (potencial) cualquier otra página server que quiera el mini
  route map sin SSR pain.

**Regla**: nunca importar `AssetMiniMap` directamente desde una
página · siempre via `<AssetRouteMap>`.

---

## P. `<TripsTable>` · prop `sortHostMode`

**Archivo**: `src/components/maxtracker/TripsTable.tsx`

**Cambio en lote E5**: prop opcional `sortHostMode` que permite
override del href del sort header. Sin la prop, el sort se
comporta como antes (push a `/seguimiento/viajes?...`). Con la
prop, el sort queda en la página host.

**Por qué datos en lugar de callback**: la prop tiene que cruzar
el límite Server → Client (la host page suele ser Server
Component, TripsTable es Client). Next.js App Router **no
serializa funciones** a través de ese límite — falla en runtime
con "Functions cannot be passed directly to Client Components".
La prop se diseñó como datos planos (string + objeto) que sí
serializan. TripsTable, que ya es Client Component, construye
la URL internamente.

**Caso de uso**: cuando `<TripsTable>` se embebe inline en otra
página (ej. la 360 del vehículo, tab Histórico), el usuario no
debe ser sacado de la página al ordenar:

```tsx
<TripsTable
  trips={trips}
  sortParams={filters}
  sortHostMode={{
    basePath: `/gestion/vehiculos/${assetId}`,
    preserveParams: { tab: "historico" },
  }}
/>
```

`basePath` es la ruta sin query string · `preserveParams` son
los params que deben mantenerse en TODOS los URLs de sort
(típicamente la tab activa). TripsTable agrega encima los
`sort` / `dir` del nuevo estado.

**Regla**: si la TripsTable se monta fuera de
`/seguimiento/viajes`, **siempre** pasar `sortHostMode` o el
sort va a desencajar al usuario.

**Anti-pattern · NO HACER**:

```tsx
// ❌ Esto rompe en runtime: las funciones no cruzan el límite
//    Server → Client del App Router.
<TripsTable
  sortHrefBuilder={(next) => `/foo?sort=${next.sort}`}
/>
```

---

**Última actualización**: lote E5 + fix CSS modules / server-client boundary
