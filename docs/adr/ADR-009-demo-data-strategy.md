# ADR-009 · Demo data strategy · CSV reales sin shift, duplicación pendiente

**Status:** Accepted (Sub-lote 3.4)
**Date:** 2026-04-25

## Context

El demo necesita datos creíbles para presentaciones. Tenemos dos
fuentes posibles:

1. **Trayectorias reales** exportadas en CSV desde la plataforma
   actual de producción (avl.maxtracker.com)
2. **Datos sintéticos** generados por el seed con faker.js

Decisiones a tomar:

- ¿Los timestamps de los CSV se shiftean para que coincidan con
  "ayer real"?
- ¿Qué hacer con días que no tienen CSV cargado?
- ¿Coexisten datos sintéticos con reales para los mismos vehículos?

## Decision

### 1 · Sin shift de timestamps

Las trayectorias reales mantienen sus timestamps originales del
CSV. Si un CSV es del 23/04/2026, en la DB queda como 23/04/2026.

**Razones:**

- Predictibilidad: la fecha en la URL coincide con la del CSV
  source. No hay "magia" temporal que confunda al desarrollador
  o al operador
- Eliminación de bugs de timezone: se intentó shiftear con varios
  enfoques (UTC midnight, AR midnight, wall-clock real) y todos
  introdujeron edge cases. La solución más robusta fue no shiftear
- Trazabilidad: si un dato se ve raro, vamos al CSV original con
  la misma fecha

### 2 · Default date = última fecha con datos

Cuando el usuario entra a `/seguimiento/historial` sin fecha en
URL y elige un asset, la página consulta la última fecha donde
ese asset tiene posiciones (en hora local AR) y la usa como
default.

Esto compensa la decisión #1: el usuario no necesita saber qué
fecha pedir, el sistema le muestra automáticamente la más reciente.

### 3 · Vehículos reales NO generan datos sintéticos

Los 11 assets con flag `realCsvFile` se excluyen explícitamente
de los bloques `generating positions`, `demo-day positions` y
`generating events`. Solo tienen los datos del CSV.

**Razón:** evitar contaminación. Si un vehículo tiene 1 día real
y 30 días sintéticos al lado, el operador no sabe cuál es real.

### 4 · Días sin CSV → duplicar uno real (PENDIENTE)

Cuando un vehículo real necesita datos para una fecha sin CSV:

```
SE DUPLICA un CSV existente del mismo vehículo, con shift de
fecha al día faltante.

Criterio de elección del CSV fuente:
  · Mismo día de la semana (lunes con lunes, etc) si está disponible
  · Cualquier otro CSV del mismo vehículo si no
```

**Razón:** preferimos datos reales repetidos a datos sintéticos
fabricados. Aunque se note la repetición, mantiene patrones de
operación coherentes (jornadas, paradas reales, eventos legítimos).

**Estado:** No implementado. Esperando más CSVs por vehículo (mínimo
2-3 días distintos) para que la duplicación tenga buena fuente y
no termine repitiendo siempre el mismo día.

## Consequences

### Positivas

- Demo robusto sin bugs de timezone
- Datos creíbles para presentaciones (todo viene de producción real)
- URL de fecha es declarativa (la que se ve es la que se busca)
- Cuando se implemente la duplicación, los datos seguirán siendo
  100% reales en su patrón de operación

### Negativas

- Hoy los vehículos reales solo tienen datos en 1-2 fechas
  específicas. Si el usuario navega a otras fechas, ve panel vacío
- La duplicación pendiente requiere 2-3 CSVs por vehículo para
  funcionar bien (sin patrones repetidos visibles)

### Neutras

- Los assets sintéticos siguen funcionando igual (positions
  últimos 30 días + demo-day denso)
- El default date logic agrega una query extra (`getLatestDateWithData`)
  por page load cuando no hay fecha en URL

## Implementation pointers

```
prisma/seed.ts                   re-anchor eliminado · skip de sintéticos
prisma/seed-data/parse-real-csv.ts  parser CSV
prisma/seed-data/real-vehicles.ts   catálogo
src/lib/queries/historicos.ts    getLatestDateWithData()
src/app/seguimiento/historial/page.tsx   uso del default
```

## Cuándo revisar esta decisión

Cuando se cumpla cualquiera de estas condiciones:

- Todos los vehículos reales tienen al menos 5 días de CSVs cargados
  → considerar implementar duplicación o sacar la lógica
- Aparece feedback de operadores que confunden fechas
  → considerar volver al shift "demo siempre muestra ayer"
- Performance se degrada en `getLatestDateWithData`
  → cachear o materializar
