# ADR-016 · Time pickers unificados (4 componentes)

**Status:** Accepted
**Date:** 2026-05-02
**Lote:** L3-IA + L3.A-E (sub-lotes de migración)
**Decision-makers:** Alejandro (PO), Claude (orquestador)

## Contexto

Pre-L3-IA · Maxtracker tenía 5 patrones distintos de selección temporal conviviendo:

| Pantalla | Componente actual | Patrón |
|---|---|---|
| `/actividad/viajes` | `DateRangePicker` (L3) | Rango libre + presets |
| `/actividad/evolucion` y `/resumen` | `PeriodNavigator` | Granularidad + ancla |
| `/objeto/[tipo]/[id]` | `PeriodNavigator` | Idem |
| `/seguimiento/historial` | `HistoricosFilterBar` | Día + opcional rango horario |
| `/direccion/boletin/[period]` | URL fija + flechas | Mes específico |

Después de benchmark contra Samsara, Geotab, HubSpot, Google Analytics, Splunk · todos los SaaS enterprise convergen en el mismo modelo · **un solo selector de fechas de rango libre + presets relativos**, y la **granularidad de display la maneja el reporte/widget**, NO el selector de tiempo.

## Decisión

Adoptar el patrón industria con 4 componentes especializados:

### 1. `TimeRangePicker` · rango libre + presets

Reemplaza al `DateRangePicker` original (L3). Mejoras:
- 14 presets disponibles (vs 6 antes) · cubre quick / week / month / quarter / year / YTD
- Variantes inline y stacked
- Locale-aware (Argentina UTC-3 default)
- Usado en Trips, Reportes (evolucion + resumen), Objeto

### 2. `GranularityToggle` · separado del tiempo

Nuevo componente que ocupa el espacio que antes ocupaban los chips de granularidad **dentro** del PeriodNavigator. Ahora la granularidad es un control independiente.

```
[ Selector de tiempo ]              [ Selector de display ]
[📅 Oct 1 → Oct 31] [Ayer][7d]      Agrupar por: [Día][Semana][Mes]
```

Más limpio · más alineado con Samsara/HubSpot.

### 3. `MonthPicker` · selector específico de mes

Para el Boletín · que es un artefacto editorial cerrado, no un dashboard con filtros. Mantener un selector de mes dedicado preserva la integridad conceptual.

Features distintivas:
- Dropdown con lista de meses (24 meses históricos)
- Dot verde para meses con datos disponibles
- Flechas ‹ › para navegar mes a mes

### 4. `DayWithTimePicker` · día + slider horario

Para Historial · 1 día específico con rango horario opcional intra-día. Slider con 2 thumbs (cada step = 30 min · 48 steps total).

Features:
- Botones "Hoy" y "Ayer" como atajos
- Checkbox "Todo el día" resetea slider a 00:00 → 24:00
- Track activo entre los thumbs muestra visualmente el rango

## Decisiones de API justificadas

### Strings YYYY-MM-DD en lugar de Date objects

Razón: Date cruzando boundaries tiene líos de timezone. Inputs nativos `<input type="date">` ya devuelven string · respetar ese contrato.

### `today` overrideable

El demo del MVP tiene data fija en abril 2026. Sin override, "Ayer" sería un día sin datos. En producción no se pasa override.

### `tzOffsetHours` overrideable

Default -3 (Argentina). Para futuros tenants en otras zonas LATAM (Chile UTC-3 mismo, México UTC-6, Brasil UTC-3) se pasa el offset.

### `availableMonths` opcional en MonthPicker

Si se pasa, marca con dot verde los meses con datos. Si se omite, todos los meses se muestran sin distinción · útil para casos donde la pantalla no conoce qué períodos tienen datos.

### Slider con 2 thumbs nativo HTML

Razón: cero dependencias, accesibilidad nativa por keyboard. Trade-off · el "track activo" se simula con un div absolutamente posicionado · funcional pero no es el slider más sofisticado del mundo. Aceptable para MVP.

## Trade-offs

### Positivos

- API consistente entre las 4 pantallas con selección temporal
- Patrón industria · cero curva de aprendizaje para users que vienen de Samsara/Geotab
- Granularidad separada del tiempo · más limpio conceptualmente
- 4 componentes especializados > 1 mega-componente con union types complicados
- TypeScript discriminated tipos cuando hace falta
- Inputs nativos `<input type="date">` · soporte universal

### Negativos

- 4 componentes en lugar de 1 · más código pero más mantenible
- DayWithTimePicker tiene complejidad propia (slider con 2 thumbs custom CSS)
- Migración de PeriodNavigator requiere tocar Reportes + Objeto (lotes L3.B-D)

### Nulos

- No requiere cambios de schema
- Coexistencia con componentes legacy durante la transición · sin breaking changes inmediatos
- No afecta queries

## Plan de migración

5 sub-lotes incrementales:

| Sub-lote | Pantalla | Componente |
|---|---|---|
| L3.A | Trips | TimeRangePicker (renombre desde DateRangePicker) |
| L3.B | Reportes (evolucion + resumen) + Objeto | TimeRangePicker + GranularityToggle |
| L3.C | Historial | DayWithTimePicker |
| L3.D | Boletín | MonthPicker |
| L3.E | Cleanup | Borrar PeriodNavigator, HistoricosFilterBar, DateRangePicker viejo |

Cada lote convive con la versión vieja · si rompe algo, revertir solo ese lote.

## Referencias

- Benchmark · Samsara, Geotab, HubSpot, Salesforce, Google Analytics, Splunk
- HANDOFF.md · BLOQUE 3 · L3 DateRangePicker
- ADR-014 · DateRangePicker (L3 original)
