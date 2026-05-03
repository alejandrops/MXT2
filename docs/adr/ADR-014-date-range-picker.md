# ADR-014 · DateRangePicker unificado

**Status:** Accepted
**Date:** 2026-05-02
**Lote:** L3
**Decision-makers:** Alejandro (PO), Claude (orquestador de desarrollo)

## Contexto

Hasta L3, cada pantalla con filtro temporal duplicaba su propio bloque de inputs de fecha + presets. El caso más visible · `TripsFilterBar` tenía ~80 líneas dedicadas a:
- 2 inputs `<input type="date">` con sus handlers
- 3 buttons de presets ("Ayer", "7 días", "30 días")
- helper local `ymd()` para format YYYY-MM-DD
- lógica de `applyDate` y `applyPreset` con timezone hardcoded

Al revisar el repo se identificaron **4 patrones distintos** de selección temporal en uso:

| Pantalla | Patrón | Caso |
|---|---|---|
| `/actividad/viajes` | `[from, to]` libre + presets | Multi-día |
| `/seguimiento/historial` | `date` + opcional `[fromTime, toTime]` | 1 día con rango horario |
| `/direccion/*` (multiple) | `YYYY-MM` (mes) | Período cerrado |
| `/objeto/[tipo]/[id]` | `granularity + anchor` | Granularity-based |

Tratar de unificar los 4 en un solo componente es over-engineering · forzaría props condicionales y mucho dead-rendering.

## Decisión

Crear `<DateRangePicker />` que cubre **solo el patrón "rango libre + presets"** (caso Trips). Los otros 3 patrones quedan como están y, si hay deseo de unificarlos, son lotes propios futuros (`L3.1` para DayWithTimeRangePicker, `L3.2` para MonthPicker, etc.).

### API

```tsx
<DateRangePicker
  value={{ from: "2026-04-01", to: "2026-04-30" }}
  onChange={(next) => router.push(buildHref(next))}
  presets={["yesterday", "7d", "30d"]}        // optional · default todos
  today={demoSeedDate}                         // optional · default Date.now()
  tzOffsetHours={-3}                           // optional · default Argentina
  disabled={isPending}                         // optional
/>
```

### Decisiones de API justificadas

**Strings YYYY-MM-DD en vez de Date objects.**
Razón: Date objects cruzando boundaries tienen líos de timezone. El input nativo `<input type="date">` ya devuelve string · respetar ese contrato evita conversiones innecesarias.

**`today` overrideable.**
Razón: el demo del MVP tiene data fija fechada en abril 2026. Sin override, "Ayer" sería un día sin datos. El override permite a la pantalla decir "para los presets, considerá hoy = 2026-04-26". Producción no usa override.

**`tzOffsetHours` overrideable.**
Razón: futuros tenants en Chile (UTC-3 → mismo, OK), México (UTC-6), Brasil (UTC-3) necesitan que "ayer" sea su ayer local, no UTC. El offset numérico es el mínimo viable · evita dependencia de Intl.DateTimeFormat o IANA tz database.

**Detección automática del preset activo.**
Razón: si el usuario elige un rango y luego abre la página de nuevo via URL, el preset activo se calcula del backend y se resalta. Sin detect, los presets se desincronizarían visualmente.

**`presets={[]}` deshabilita los presets sin tocar el componente.**
Razón: hay casos donde solo querés inputs nativos (ej: filter sidebar de un reporte específico). Pasar array vacío es el opt-out idiomático de React.

**Inputs nativos `<input type="date">` en vez de un calendar custom.**
Razón: 3 razones acumulativas:
1. Soporte universal · iOS Safari, Android Chrome, todos los desktops modernos.
2. Sin dependencia · librerías como `react-day-picker` agregan ~30KB y reglas de accesibilidad propias.
3. Locale automático · el browser elige el formato visual según el locale del user. Argentino ve dd/mm/yyyy, gringo ve mm/dd/yyyy, sin código.

Trade-off · el calendar nativo no se ve igual entre browsers. Aceptable para MVP.

## Consecuencias

### Positivas

- TripsFilterBar pierde ~80 líneas de boilerplate. Más legible.
- Próxima pantalla con rango libre lo agrega en 1 prop.
- Timezone-aware desde la primera línea (vs hardcoded UTC en el código viejo).
- Detección de preset activo · feedback visual gratis.

### Negativas

- 4 archivos nuevos en `components/maxtracker/DateRangePicker/`. Aceptable · cohesión > flat structure.
- TripsFilterBar.module.css ahora tiene CSS dead (selectors `.dateBlock`, `.dateInput`, etc., no usados). Limpieza en lote separado de cleanup CSS · no urgente.
- 3 patrones más de fecha siguen diseminados. Plan: L3.1, L3.2, L3.3 cuando haya bandwidth.

### Nulas

- No afecta queries ni schema.
- TripsFilterBar funciona idéntico al pre-migración (tests visuales).

## Validación

```bash
npx tsc --noEmit; echo exit=$?
# Esperado · 0 errores

# Visual · /actividad/viajes
# 1. Cambiar from/to · URL refleja
# 2. Click "Ayer" · rango se aplica, preset se resalta azul
# 3. Cambiar from a YYYY-MM-DD random · ningún preset activo
# 4. Click "30 días" → "7 días" · cambia y resalta nuevo preset
```

## Próximo paso

Si querés unificar los otros 3 patrones (Historicos, Direccion, Objeto), son lotes propios cada uno · cada patrón tiene props distintos. No hay ganancia evidente en forzar un mega-componente con union types complicados.

L4 del pipeline (Botones volver dinámicos) es independiente · puede ir antes o después.

## Referencias

- HANDOFF.md · BLOQUE 3 · L3 DateRangePicker unificado
- TripsFilterBar.tsx pre-L3 · ~80 líneas boilerplate
- HistoricosFilterBar, PeriodNavigator, ActivityBookTab · patrones distintos no migrados
