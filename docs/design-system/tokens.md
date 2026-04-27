# DOC-10 · Design Tokens

> Sub-documento del Design System.
> Catálogo completo de CSS custom properties (`--*`) declaradas en `src/app/globals.css`.
> Toda regla del sistema deriva de esta tabla.

---

## 1 · Color

### 1.1 · Brand

Identidad de Maxtracker. Estos tokens nunca se usan como semántica de
estado — para eso están las paletas semánticas más abajo.

| Token | Valor | Uso |
|---|---|---|
| `--dark` | `#0C1520` | ModuleBar background · avatar · botones primarios oscuros |
| `--dark2` | `#1A2535` | Hover states sobre `--dark` · separadores en ModuleBar |
| `--red` | `#E8352A` | Brand accent · subrayado de tab activo · brand mark sidebar |
| `--red-dark` | `#C42820` | Hover red · texto rojo intenso (números críticos) |

> **Nota:** `--red` se reusa también como token semántico de problema
> crítico. La doble función es deliberada: el brand de Maxtracker está
> alineado con la noción de alerta (telemática = monitoreo = riesgo).

### 1.2 · Paletas semánticas

Cada paleta tiene **4 variantes**: el color base, un fondo de baja
saturación (`-bg`), un texto oscuro para usar sobre el fondo (`-t`), y un
borde sutil (`-brd` o `-b`). Esta estructura permite componer pills,
badges, banners y cards manteniendo contraste WCAG AA.

#### Red · Crítico / problema

| Token | Valor | Uso |
|---|---|---|
| `--red` | `#E8352A` | Severity dots (CRITICAL) · borde lateral de cards CRITICAL · números rojo |
| `--red-dark` | `#C42820` | Texto rojo intenso · scores < 60 |
| `--red-bg` | `#FEF0EF` | Fondo de pills CRITICAL · score badge red · alarma |
| `--red-t` | `#7F1D1D` | Texto sobre `--red-bg` · etiquetas dentro de pill rojo |
| `--red-b` | `#FECACA` | Borde de pills `--red-bg` |

#### Orange / Amber · Caución / atención

| Token | Valor | Uso |
|---|---|---|
| `--ora` | `#F59E0B` | Severity dots (HIGH y MEDIUM) · borde lateral HIGH |
| `--ora-bg` | `#FFFBEB` | Fondo de pills caución · score badge ámbar |
| `--ora-t` | `#78350F` | Texto sobre `--ora-bg` · score < 80 |
| `--yel-brd` | `#FDE68A` | Borde de pills `--ora-bg` |

> Los aliases `--amb`, `--amb-bg`, `--amb-t` apuntan a los mismos valores
> de orange. Se mantienen por compatibilidad con código que usa
> nomenclatura "amber".

#### Green · OK / saludable

| Token | Valor | Uso |
|---|---|---|
| `--grn` | `#059669` | Severity dot (LOW saludable) · status MOVING |
| `--grn-bg` | `#ECFDF5` | Fondo pills MOVING · score ≥ 80 |
| `--grn-t` | `#064E3B` | Texto sobre `--grn-bg` |
| `--grn-brd` | `#86EFAC` | Borde de pills `--grn-bg` |

#### Blue · Neutral / operativo

| Token | Valor | Uso |
|---|---|---|
| `--blu` | `#2563EB` | Status IDLE · severity LOW · enlaces secundarios |
| `--blu-bg` | `#EFF6FF` | Fondo pills IDLE · banners informativos |
| `--blu-t` | `#1E3A8A` | Texto sobre `--blu-bg` |
| `--blu-brd` | `#BFDBFE` | Borde de pills `--blu-bg` |

#### Teal · Informativo

| Token | Valor | Uso |
|---|---|---|
| `--tel` | `#0891B2` | Reservado para badges informativos terciarios |
| `--tel-bg` | `#ECFEFF` | — |
| `--tel-t` | `#164E63` | — |
| `--tel-brd` | `#A5F3FC` | — |

> En Lote 1 esta paleta no se usa todavía. Reservada para datos de tipo
> "telemetría reciente" o "información de sistema" que en futuros lotes
> requieran su propio canal cromático.

#### Purple · Énfasis / acción premium

| Token | Valor | Uso |
|---|---|---|
| `--pur` | `#7C3AED` | Reservado para acciones premium / IA / features pro |
| `--pur-bg` | `#F5F3FF` | — |
| `--pur-t` | `#4C1D95` | — |

> Reservada. No usada en Lote 1.

### 1.3 · Surfaces & text

Tokens neutros que estructuran toda la UI. El "color por defecto" de
cualquier superficie sale de acá.

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#EDEEF1` | Fondo de página · hover sutil |
| `--sf` | `#FAFAFA` | Superficie de cards y tarjetas · row hover (alterna con --bg) |
| `--sf2` | `#EDEEEF` | Superficie alternada · table head · count badges neutros |
| `--brd` | `#CDD0D5` | Borde por defecto (cards, inputs, tablas) |
| `--brd2` | `#B4B8BE` | Borde enfatizado (track de score bar, hover de inputs) |
| `--tx` | `#111827` | Texto primario |
| `--t2` | `#6B7280` | Texto secundario (descripciones, metadatos) |
| `--t3` | `#9CA3AF` | Texto terciario (placeholders, labels uppercase) |
| `--hover` | `rgba(0,0,0,.04)` | Overlay sobre cualquier superficie en hover |
| `--map-bg` | `#E8EEF3` | Fondo del contenedor del mapa antes de cargar tiles |

### 1.4 · Reglas de aplicación de color

1. **Severity dots usan el color base** (`--red`, `--ora`, etc.), no el `-bg`.
2. **Pills y badges usan tríada completa**: `bg + texto + borde` de la
   misma paleta. Mezclar paletas en el mismo elemento es violación.
3. **Borde lateral redundante (HIGH y CRITICAL)**: además del color del
   dot, agregar `border-left: 2px solid var(--red)` o `--ora`. Refuerza
   la jerarquía y mejora accesibilidad para daltonismo.
4. **Hover de cards clickeables**: `background: var(--bg); border-color:
   var(--brd2)`. Nunca cambiar el color del texto en hover de cards.
5. **Status MOVING usa green** porque "operacional + dinámico" es
   semánticamente positivo. IDLE usa blue porque "operacional + estático"
   es neutro. Los volquetes mineros y silos en estado FIXED no aplican
   color verde.

---

## 2 · Tipografía

### 2.1 · Familias

| Token | Valor | Uso |
|---|---|---|
| `--f` | `'IBM Plex Sans', system-ui, …` | Familia primaria. Títulos, descripciones, etiquetas. |
| `--m` | `'IBM Plex Mono', ui-monospace, …` | Familia mono. Datos numéricos y códigos comparables. |

**Carga:** ambas familias se cargan vía `next/font/google` en `src/app/layout.tsx`.
Pesos disponibles: Sans 400/500/600/700, Mono 300/400/500/600.

### 2.2 · Escala

#### Escala canónica (todos los componentes)

| Token | Valor | Uso |
|---|---|---|
| `--fs-hero` | `64px` | Reservado · landing pages futuras |
| `--fs-kpi` | `40px` | Reservado · KPI hero (Patrón D nivel ejecutivo) |
| `--fs-mid` | `26px` | Títulos de página (h1) |
| `--fs-sm` | `18px` | Sub-títulos |
| `--fs-xs` | `15px` | — (no usado actualmente, reservado) |
| `--fs-body` | `12px` | Texto corrido secundario |
| `--fs-label` | `10px` | Etiquetas uppercase, captions |
| `--fs-meta` | `9px` | Microcopy en pills, version tags |

#### Escala de cards (consistencia inter-card)

Tokens introducidos en Sub-lote 1.6 (DEUDA-1.3-V02) para garantizar que
todas las cards lean a la misma altura visual:

| Token | Valor | Uso |
|---|---|---|
| `--fs-card-title` | `13px` | Título principal de card (ej. tipo de alarma, nombre de driver) |
| `--fs-card-body` | `11.5px` | Línea secundaria (ej. asset name dentro de AlarmCard) |
| `--fs-card-meta` | `10.5px` | Línea terciaria · timestamp · plate · counts |

**Regla:** todo componente que sea un "card" o "row de lista" debe usar
estos tres tokens, no valores literales. Si necesitás un cuarto nivel
tipográfico dentro de una card, primero replantear el contenido.

### 2.3 · Pesos

Una escala de 4 pesos, cada uno con uso específico:

| Peso | Uso |
|---|---|
| `400` (regular) | Texto corrido por defecto |
| `500` (medium) | Títulos de card, énfasis dentro de párrafos |
| `600` (semibold) | h1, h2, labels uppercase, KPI tile values |
| `700` (bold) | Brand mark · contadores en badges · uso muy puntual |

No usar `300` (light) ni pesos intermedios. Inconsistencia.

### 2.4 · Reglas de aplicación tipográfica

1. **Todo número que pueda compararse va en `--m` (mono).** Excepción:
   contadores muy puntuales en badges donde el ancho fijo no aporta
   (en cuyo caso pueden ir en sans con `font-variant-numeric: tabular-nums`).
2. **Patentes, IMEIs, IDs, coordenadas, timestamps siempre en `--m`.**
3. **Letter-spacing positivo solo en uppercase**: `letter-spacing: 0.06em`
   o `0.07em` para etiquetas; `0.1em` para brand mark.
4. **Letter-spacing negativo en títulos grandes**: `-0.5px` a `-1px` para
   `--fs-mid`, `--fs-kpi`, `--fs-hero`. Mejora la cohesión visual de
   números grandes en mono.
5. **Line-height heredado** del browser default (1.4-1.5) salvo en KPI
   values donde lo bajamos a `1.05` para que el número "ocupe" su tile.

---

## 3 · Spacing

### 3.1 · Tokens

| Token | Valor | Uso |
|---|---|---|
| `--gap-xs` | `6px` | Separación entre icono y texto · gap dentro de pill |
| `--gap-sm` | `10px` | Gap entre items de KPI strip · gap entre cards en lista |
| `--gap-md` | `12px` | Gap interno entre elementos de una card |
| `--gap-lg` | `16px` | Gap entre secciones de página · gap entre title y subtitle |

### 3.2 · Spacing de cards

| Token | Valor | Uso |
|---|---|---|
| `--pad-card` | `10px 12px` | Padding interno de **toda card del sistema** |

**Regla irrompible:** ninguna card usa un padding distinto. Si necesitás
más respiración interna, aumentá el `gap` entre líneas, no el padding
externo. Si necesitás menos respiración, no es una card — es otra cosa
(un row, un chip, etc.).

### 3.3 · Spacing de página

Las páginas usan padding **literal** porque son superficies únicas:

```css
.page {
  padding: 16px 20px 40px;  /* top right/left bottom */
}
```

El bottom es mayor (`40px`) para crear "respiración terminal" — espacio
después del último elemento de la página, antes del fin del viewport.

---

## 4 · Layout

### 4.1 · Tokens estructurales

| Token | Valor | Uso |
|---|---|---|
| `--sw` | `220px` | Sidebar width expanded |
| `--sc` | `48px` | Sidebar width collapsed |
| `--th` | `50px` | Topbar height |
| `--mh` | `38px` | Module bar height (top black bar) |

Total chrome vertical: `--mh + --th = 88px`. Esto deja `100vh - 88px`
para contenido en cualquier viewport.

### 4.2 · Max-widths de página

| Patrón | Max-width | Justificación |
|---|---|---|
| Patrón A (Lista) | `1280px` | Tablas densas — se beneficia de ancho moderado, no full-width |
| Patrón B (Libro) | `1280px` | Detalle contextual — confort de lectura |
| Patrón D (Dashboard) | `1280px` | KPIs + paneles — 1280 mantiene la grilla legible en monitores grandes |

Sweet spot inspirado en HubSpot/Samsara. En monitores ≥ 1920px las
páginas quedan alineadas a la izquierda con espacio neutro a la derecha
(no centramos).

### 4.3 · Grids estándar

#### KPI strip

```css
display: grid;
grid-template-columns: repeat(N, minmax(MIN, MAX));
gap: var(--gap-sm);
justify-content: start;
```

Donde `N`, `MIN`, `MAX` dependen del patrón:

| Patrón | N | min | max |
|---|---|---|---|
| Dashboard D (4 KPIs) | 4 | 220px | 280px |
| Lista A (5 KPIs) | 5 | 160px | 220px |
| Libro B (4 KPIs) | 4 | 200px | 280px |

#### Two-column body

```css
display: grid;
grid-template-columns: 2fr 1fr;
gap: 20px;
align-items: start;

@media (max-width: 1100px) {
  grid-template-columns: 1fr;  /* colapsa a 1col */
}
```

---

## 5 · Radii

### 5.1 · Tokens

| Token | Valor | Uso |
|---|---|---|
| `--r` | `2px` | Default genérico (legacy, equivale a `--r-md`) |
| `--r-sm` | `1px` | Pills, badges pequeñas, elementos densos |
| `--r-xs` | `1px` | Inputs y kbd tags |
| `--r-md` | `2px` | Cards, botones, tablas, tiles |
| `--r-pill` | `2px` | Pills (a pesar del nombre, sigue siendo casi cuadrado) |
| `--r-full` | `50%` | Avatares circulares · severity dots |

### 5.2 · Filosofía de radii

Es deliberadamente conservador. Productos modernos B2C usan radii de
8-16px. Nuestro sistema usa 1-2px porque:

1. **Mayor densidad percibida.** Bordes casi rectos hacen que las cards
   se vean "más planas y técnicas".
2. **Coherencia con SCADA.** Los sistemas de monitoreo industrial usan
   radii muy bajos. Es la convención del rubro.
3. **Diferenciación.** Inmediatamente distingue Maxtracker de productos
   B2C "amigables".

Un radio = 0 (totalmente cuadrado) se descartó por verse "agresivo".
1-2px da el equilibrio: técnico sin ser brutal.

---

## 6 · Iconografía

### 6.1 · Library

[`lucide-react`](https://lucide.dev) versión `^0.468.0`.

### 6.2 · Stroke standard

Toda icon del sistema renderiza con:

```css
.ico svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

`currentColor` significa que el icon hereda el color del texto contenedor.
Esto permite componer iconos dentro de pills, links, etc. sin colorearlos
manualmente.

### 6.3 · Tamaños canónicos

| Tamaño | Uso |
|---|---|
| `11` | Inline en line-3 de cards (icon prefix de meta) |
| `13` | Botones secundarios, breadcrumb separators |
| `14` | Chevrons en cards y rows clickeables |
| `15` | Sidebar nav icons |
| `16` | (no usado) |
| `28` | Brand mark en sidebar |

Múltiplos de 8 (16, 24, 32) **no se usan** porque rompen la grid de 11/13/14
que viene de la escala tipográfica.

---

## 7 · Hover & focus states

### 7.1 · Hover sobre superficies

| Elemento | Hover style |
|---|---|
| Card clickeable | `background: var(--bg); border-color: var(--brd2)` |
| Row de tabla | `background: var(--bg)` |
| Botón secundario | `background: var(--bg); border-color: var(--brd2)` |
| Link de navegación | `color: var(--tx)` (heredado), no cambia background |
| Tab inactivo | `color: var(--tx)`, sin underline hasta activo |

### 7.2 · Transiciones

Solo se permiten transiciones funcionales **bajo 150ms**:

| Propiedad | Duración |
|---|---|
| `background` | `0.1s` |
| `border-color` | `0.1s` |
| `color` | `0.1s` |
| `transform` (chevrons) | `0.15s` |
| `width` (sidebar collapse) | `0.18s ease` |

Animaciones de entrada (`@keyframes`) limitadas a 0.18s con `ease`. Una
sola animación está definida (`slideDown` para el accordion del sidebar).

### 7.3 · Focus visible

Todos los elementos interactivos heredan el outline default del browser
para focus de teclado. Customizar focus rings es trabajo de Lote 4
cuando pase el audit de accesibilidad.

---

## 8 · Breakpoints

```
@media (max-width: 1100px) { /* tablet & narrow desktop */ }
@media (max-width: 900px)  { /* tablet portrait */ }
@media (max-width: 700px)  { /* mobile */ }
```

**Nota:** el sistema es **desktop-first** por diseño. El producto vive en
escritorios de 13"+ en producción real. La compatibilidad mobile es
funcional pero no optimizada — es un objetivo de Lote 4+.

---

## 9 · Cómo usar tokens

### 9.1 · En CSS Modules

```css
/* MyComponent.module.css */
.card {
  background: var(--sf);
  border: 1px solid var(--brd);
  padding: var(--pad-card);
  border-radius: var(--r-md);
  font-size: var(--fs-card-title);
  color: var(--tx);
}
```

### 9.2 · Inline styles (último recurso)

```tsx
<div style={{ color: "var(--t3)", fontFamily: "var(--m)" }}>
  hace 3d
</div>
```

Solo cuando un valor es muy específico de un único uso y no justifica un
`.module.css` separado.

### 9.3 · Lo que NO se debe hacer

```tsx
{/* ❌ valores hardcoded */}
<div style={{ color: "#9CA3AF", fontSize: "10.5px" }}>...</div>

{/* ❌ tokens fuera de su paleta */}
<div style={{ background: "var(--red-bg)", color: "var(--grn)" }}>...</div>

{/* ❌ radii inventados */}
<div style={{ borderRadius: "8px" }}>...</div>
```

---

## 10 · Auditoría de uso real (Lote 1)

### 10.1 · Tokens usados

✅ **100% de tokens declarados están en uso real** en al menos un componente
o página. Sin tokens "huérfanos" definidos pero nunca aplicados.

### 10.2 · Tokens reservados

Los tokens documentados como "Reservado" (paletas tel, pur; `--fs-hero`;
`--fs-xs`; `--fs-kpi`) están definidos para evitar churn cuando aparezcan
los casos de uso en lotes 2-4. Si después de Lote 4 siguen sin uso, se
eliminan.

### 10.3 · Valores literales detectados

Auditando el código de Lote 1 detectamos algunos casos donde se usaron
valores literales en lugar de tokens. Documentamos como deuda técnica
para Sub-lote 2.x:

```
src/components/maxtracker/AssetTable.module.css
  · padding 10px 12px en .cellLink (debería ser var(--pad-card))
src/components/maxtracker/AssetFilterBar.module.css
  · padding 6px 10px en .select (custom, OK pero documentar como decisión)
src/components/maxtracker/DriverScoreCard.module.css
  · width 32px del avatar (literal, OK porque es un único componente con avatar)
```

Ninguno es bloqueante. Se barren en un futuro lote de polish o naturalmente
al refactorizar.

---

## 11 · Próximas extensiones

Tokens previstos para lotes futuros (no implementados):

- `--fs-table-row` — controlar densidad de tabla en variantes (compact, normal, comfortable)
- Paleta dark mode (`--dark-bg`, `--dark-sf`, etc.) — Lote 4+
- Breakpoint tokens (`--bp-mobile`, `--bp-tablet`) para usar en `clamp()`
- Sombras (`--shadow-sm`, `--shadow-md`) — actualmente el sistema usa solo bordes, sin sombras

Cuando alguno de estos se introduzca, se agrega a este documento + ADR
correspondiente.
