# DOC-10 · Design System

> **Maxtracker · Telemática IoT enterprise**
> Sistema de diseño extraído del Lote 1 del demo funcional.
> Versión 1.0 · Sub-lote 2.1 · 2026-04-25

---

## Tabla de contenidos

| Documento | Contenido |
|---|---|
| **DOC-10 · Design System** (este archivo) | Filosofía, principios, mapa, decisiones inaugurales |
| [`tokens.md`](./tokens.md) | Color · tipografía · spacing · radii · layout · iconografía |
| [`components.md`](./components.md) | Catálogo de los 15 componentes con anatomía, props y variantes |

---

## 1 · Filosofía de diseño

Maxtracker es una herramienta de trabajo, no un producto de consumo. Un fleet
manager pasa **6-10 horas diarias** mirando estas pantallas. Eso impone tres
restricciones permanentes sobre todas las decisiones visuales:

1. **Densidad de información sobre decoración.** Cada píxel cuenta.
   Cualquier elemento que no transmita un dato o no facilite una acción
   está de más.

2. **Color es semántica, no estética.** El rojo significa problema, el
   verde significa OK, el azul significa neutral-operativo. Usar el color
   con cualquier otro propósito (decorar, agrupar, destacar arbitrariamente)
   debilita el sistema.

3. **El usuario regresa a esta pantalla mañana.** No se diseña para "wow",
   se diseña para **resistencia visual**: que sea legible y eficiente
   después de 200 horas de uso. Eso se logra con baja saturación, alta
   relación señal/ruido, y consistencia obsesiva.

### Anti-patrones explícitos

Tres patrones de UI moderna que **rechazamos** en este sistema:

- **Glassmorphism, neumorphism, gradients decorativos.** Generan ruido
  visual sin aportar información.
- **Dark mode a tiempo completo.** El producto vive 80% del tiempo en
  ambientes con luz; el modo oscuro se evalúa como variant futura, no
  como modo primario.
- **Animaciones largas o decorativas.** Solo se permiten transiciones
  funcionales <150ms (hover, focus, navegación dentro de la misma página).

---

## 2 · Referencias del rubro

El sistema cita conscientemente tres productos de referencia:

| Producto | Rol en Maxtracker | Qué se imita |
|---|---|---|
| **HubSpot** | Modelo UI primario | Navegación enterprise (sidebar accordion, breadcrumbs, topbar minimal), object pages, density patterns |
| **Samsara** | Referencia primaria del rubro IoT/fleet | Dashboards operativos, alarm cards, status pills, mapas con markers |
| **Geotab** | Referencia secundaria técnica | Rule builder, exception-based reporting, metodologías de scoring (Hybrid Method, g-force thresholds) |

**Jerarquía de conflicto:** cuando HubSpot y Samsara divergen en un patrón,
gana **HubSpot para navegación** (transversal) y **Samsara para componentes
de telemática** (específicos del dominio). Geotab solo se invoca para
decisiones de profundidad técnica.

---

## 3 · Principios operativos

### 3.1 · Tipografía SCADA

El sistema usa la familia **IBM Plex** (Sans + Mono) por una razón concreta:
los datos numéricos críticos (velocidad, score, coordenadas, timestamps)
deben tener **anchos de carácter idénticos** para que el ojo encuentre
diferencias en una columna sin reordenamiento mental.

- **IBM Plex Sans** para títulos, etiquetas, descripciones
- **IBM Plex Mono** para todo número, código de patente, coordenada,
  timestamp, IMEI, score, contador

**Regla irrompible:** si el dato puede compararse fila a fila o cambiar
en el tiempo, va en mono. Excepción: nombres propios, descripciones libres.

### 3.2 · Color semántico

Cada estado del dominio mapea a **una sola tríada cromática**:

| Estado del dominio | Token base | Background | Border | Texto |
|---|---|---|---|---|
| Crítico / problema | `--red` | `--red-bg` | `--red-b` | `--red-t` |
| Caución / atención | `--ora` | `--ora-bg` | `--yel-brd` | `--ora-t` |
| OK / saludable | `--grn` | `--grn-bg` | `--grn-brd` | `--grn-t` |
| Neutral / operativo | `--blu` | `--blu-bg` | `--blu-brd` | `--blu-t` |
| Informativo | `--tel` | `--tel-bg` | `--tel-brd` | `--tel-t` |
| Énfasis / acción | `--pur` | `--pur-bg` | — | `--pur-t` |

Usar un color fuera de su tríada (por ejemplo, fondo verde con borde rojo)
es violación del sistema. Si necesitás un contraste especial, primero
preguntate si el caso de uso ya está cubierto por algún token existente.

### 3.3 · Severity scale

La severidad es un eje de 4 niveles que aparece en eventos, alarmas, y por
extensión en el scoring de seguridad:

| Severidad | Color | Uso |
|---|---|---|
| `LOW` | Azul (`--blu`) | Informativo, no requiere acción |
| `MEDIUM` | Ámbar (`--ora` saturación media) | Vigilar, no escalar |
| `HIGH` | Naranja (`--ora` saturación alta) | Atender pronto |
| `CRITICAL` | Rojo (`--red`) | Atender ya |

`HIGH` y `CRITICAL` reciben un **borde lateral izquierdo** adicional como
señal redundante (no solo color), para accesibilidad de personas con
daltonismo y para reforzar la jerarquía visual cuando hay muchas filas.

### 3.4 · Score scale (safety)

La métrica de safety score (0-100) usa **tres bandas** con cortes
documentados:

| Banda | Rango | Color | Significado |
|---|---|---|---|
| Crítico | < 60 | Rojo | Conductor requiere intervención inmediata |
| Caución | 60-79 | Ámbar | Conductor con margen de mejora |
| Saludable | ≥ 80 | Verde | Conductor sin patrones preocupantes |

Estos cortes derivan de la metodología Hybrid Method de Geotab adaptada
al contexto LATAM (ver memoria del proyecto, Sub-lote 2.3 ADR-009 si llega
a formalizarse).

### 3.5 · Tufte-ismo aplicado

Tres reglas operativas del enfoque Tufte que pasamos a regla del sistema:

1. **Color solo para anomalías.** En una tabla de 25 filas, si todas se
   ven igual de coloreadas, ninguna destaca. El estado base es gris/neutro;
   el rojo o ámbar aparece solo cuando hay algo fuera de norma.

2. **Sin bordes decorativos.** Los bordes existen para separar contenido,
   no para "decorar tarjetas". Un border solo se justifica si su ausencia
   produce ambigüedad de agrupación.

3. **Data density over decoration.** Antes de agregar un elemento visual,
   preguntar: ¿qué dato del dominio está mostrando? Si la respuesta es
   "ninguno, es para que se vea mejor", se elimina.

### 3.6 · Spacing primitivo

El sistema usa una **escala de 4 valores** (no 8 ni 16). Más opciones
producen inconsistencia sin beneficio:

| Token | Valor | Uso |
|---|---|---|
| `--gap-xs` | 6px | Separación entre elementos íntimos (icono+texto) |
| `--gap-sm` | 10px | Separación entre items de una lista densa |
| `--gap-md` | 12px | Separación interna estándar dentro de una card |
| `--gap-lg` | 16px | Separación entre secciones de una página |

Padding interno de cards: `var(--pad-card)` (10px 12px) — único en el
sistema, no usar otro valor.

### 3.7 · Radii minimal

El sistema usa radii muy pequeños (1-2px). Las tarjetas modernas con
`border-radius: 12px+` se sienten "amigables" pero contradicen la
densidad enterprise. **Todo radio en este sistema es ≤ 2px.** Excepción
única: avatares (`border-radius: 50%`).

---

## 4 · Mapa del sistema

### 4.1 · Stack de capas

```
┌─────────────────────────────────────────────────────────┐
│ Page composites · 3 patrones (A · B · D)                │
│   /seguridad · /seguridad/assets · /seguridad/assets/[id]│
├─────────────────────────────────────────────────────────┤
│ Composites · 1                                          │
│   AssetHeader                                           │
├─────────────────────────────────────────────────────────┤
│ Lists & tables · 4                                      │
│   AssetTable · SortHeader · Pagination · AssetFilterBar │
├─────────────────────────────────────────────────────────┤
│ Cards · 4                                               │
│   AlarmCard · DriverScoreCard · AssetEventCard · EventRow│
├─────────────────────────────────────────────────────────┤
│ Primitives & layout · 5                                 │
│   KpiTile · StatusPill · SectionHeader · Tabs · LeafletMap│
├─────────────────────────────────────────────────────────┤
│ Tokens                                                  │
│   Color · Typography · Spacing · Radii · Layout         │
└─────────────────────────────────────────────────────────┘
```

Cada nivel solo importa de los niveles inferiores. Una **regla estricta
de capas** que vamos a formalizar como ADR-004.

### 4.2 · Patrones de página

Los 4 patrones canónicos de Maxtracker (definidos en la memoria del
proyecto). Lote 1 implementó tres:

| Patrón | Nombre | Ejemplo en Lote 1 | Característica |
|---|---|---|---|
| **A** | Lista de módulo | `/seguridad/assets` | Tabla densa con filtros, sort, paginación |
| **B** | Libro del Objeto | `/seguridad/assets/[id]` | Header + KPI strip + tabs + contenido contextual |
| **C** | Boletín | (Lote 3+) | Reporte estructurado de período cerrado |
| **D** | Dashboard | `/seguridad` | KPI strip + paneles operativos cross-cutting |

### 4.3 · Composiciones de página

Cuatro composiciones reutilizables que aparecen en múltiples pantallas:

#### KPI Strip
Línea de 4-5 tiles full-width con métricas top-line. Siempre arriba.
Width capada (220-320px por tile), justify-start. Aparece en Patrones A,
B y D.

#### Two-column body
`2fr / 1fr` en desktop, colapsa a 1col bajo 1100px. Columna izquierda
es el contenido principal, derecha es contexto secundario. Aparece en
Patrón D y Patrón B Overview.

#### Filter bar
Barra horizontal con search + 2-5 select dropdowns + "Limpiar filtros".
URL como source of truth. Aparece en Patrón A.

#### Tabbed detail
Header → KPI strip contextual → tab bar → contenido del tab activo.
Tab state en URL. Aparece en Patrón B.

---

## 5 · Decisiones inaugurales del sistema

Estas decisiones están **fijadas** y solo se cambian con un ADR explícito.

| ID | Decisión | Origen |
|---|---|---|
| **DS-001** | IBM Plex Sans + Mono como única familia tipográfica | v8.18 + ADR-000 |
| **DS-002** | Paleta semántica de 6 colores (red, ora, grn, blu, tel, pur) más surfaces neutras | v8.18 |
| **DS-003** | Severity de 4 niveles con color + borde redundante | Memoria proyecto |
| **DS-004** | Score safety con 3 bandas (60/80) | Geotab Hybrid Method |
| **DS-005** | Radii ≤ 2px (1px-2px-50%) | Tufte / enterprise density |
| **DS-006** | Spacing scale de 4 tokens (gap-xs/sm/md/lg) | Lote 1 evidence |
| **DS-007** | CSS Modules + variables CSS, no Tailwind | ADR-000 |
| **DS-008** | Color solo para anomalías, no decoración | Tufte |
| **DS-009** | Component layering en 5 niveles (tokens / primitives / cards / composites / pages) | Lote 1 evidence (será ADR-004) |
| **DS-010** | Mono font obligatorio para datos numéricos comparables | SCADA convention |

---

## 6 · Cobertura de Lote 1

Lo que el Lote 1 produjo en términos de componentes y patrones:

```
Componentes implementados:    15
Patrones implementados:        3 de 4 (A, B, D)
Cobertura de tokens:         100% (todos los tokens están en uso real)
Páginas que usan el sistema:   3 (Dashboard, Lista, Libro)
Estados UI cubiertos:        ~60%

Pendiente para lotes futuros:
  · Patrón C (Boletín)
  · Estados loading/error/empty exhaustivos
  · Modo dark variant
  · Mobile-first responsive (actualmente desktop-first)
  · Componentes form (text input, textarea, datepicker)
  · Componentes overlay (modal, drawer, toast)
  · Componentes feedback (skeleton, progress, spinner)
```

---

## 7 · Cómo extender el sistema

### Cuándo agregar un componente nuevo

Sí: si el patrón se va a repetir en **3+ lugares distintos** del producto
y no se reduce a una composición de los existentes.

No: si es para usar en un solo lugar. Inline el JSX, no inflemos el sistema.

### Cuándo modificar un token existente

Modificar un token afecta **todo el producto**. Solo se hace si:

1. La consecuencia es deliberada (ejemplo: oscurecer `--brd` para mejorar
   contraste WCAG en todo el producto).
2. Se documenta como ADR.
3. Se hace un sweep manual/visual de las pantallas más afectadas.

### Cuándo agregar un token nuevo

Solo si la necesidad es **transversal** (3+ componentes lo necesitan) y
**conceptualmente distinta** de los tokens existentes. Si solo lo necesita
un componente, vive en su `module.css` con un valor literal.

---

## 8 · Versioning y mantenimiento

Este documento se versiona junto al código en `docs/design-system/`.
Cada cambio significativo del sistema debe:

1. Actualizar el archivo correspondiente (tokens.md o components.md)
2. Crear un ADR si la decisión cambia un default establecido
3. Actualizar la sección "Decisiones inaugurales" si es una DS-XXX

**Historial:**

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 2026-04-25 | Extracción inicial desde Lote 1 (Sub-lote 2.1) |

---

## 9 · Referencias cruzadas

- [`tokens.md`](./tokens.md) · catálogo completo de design tokens
- [`components.md`](./components.md) · catálogo de los 15 componentes
- [`../adr/ADR-000-inaugural-stack.md`](../adr/ADR-000-inaugural-stack.md) · stack inaugural (incluye decisión CSS Modules)
- [`../adr/ADR-001-asset-one-group.md`](../adr/ADR-001-asset-one-group.md) · cardinality Asset 1:N Group
- [`../adr/ADR-002-prisma-config-ts.md`](../adr/ADR-002-prisma-config-ts.md) · prisma config migration
- Código de tokens en `src/app/globals.css`
- Código de componentes en `src/components/maxtracker/`
- Código de páginas en `src/app/seguridad/`
