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

---

**Última actualización**: lote E3b
