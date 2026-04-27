# ADR-008 — Seed determinism (faker.seed(42))

**Status:** Accepted
**Date:** 2026-04-25
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator
**Supersedes:** —
**Superseded by:** —
**Context:** Sub-lote 1.2 (Datos + Query Layer)

## Context

Maxtracker no es solo un producto en construcción — también es un demo
que se muestra en presentaciones a stakeholders, posibles clientes y
software factories. Esa función pone restricciones especiales sobre el
dataset:

1. **Repetibilidad.** Cuando dos personas en máquinas distintas corren
   el demo, deben ver exactamente lo mismo. Si en mi laptop hay 18
   alarmas activas y en la del cliente 23, una explicación se rompe.

2. **Coherencia.** El dataset debe contar una historia coherente —
   accounts realistas, conductores con nombres creíbles, rutas
   geográficamente posibles, eventos cuyas severidades hacen sentido.

3. **Volumen calibrado.** Ni tan poco que parezca vacío, ni tanto que
   sature las pantallas. 80 assets es el punto donde una tabla con
   filtros tiene sentido pero todo cabe en pocas páginas.

Sin gestión deliberada, `faker` (la library que usamos para generar
datos sintéticos) produce datos **distintos en cada corrida**. Cada
`npm run db:seed` daría 80 assets nuevos con nombres diferentes, scores
diferentes, distribución de status diferente.

## Decision

**Adoptar determinismo total del seed via `faker.seed(42)` al inicio
del script de seed, garantizando que cualquier corrida produce el mismo
dataset bit-a-bit.**

Implementación:

```ts
// prisma/seed.ts (línea 33)
import { faker } from "@faker-js/faker";
faker.seed(42);
faker.setDefaultRefDate(new Date("2026-04-24T12:00:00Z"));

// Resto del script usa faker normalmente
const firstName = faker.person.firstName();   // siempre el mismo
const plate = faker.vehicle.vrm();            // siempre la misma
```

Además, fijamos el `defaultRefDate` para que `faker.date.recent()`,
`faker.date.future()`, etc., usen siempre la misma fecha base. Sin esto,
los timestamps relativos varían entre corridas aunque los demás datos
sean iguales.

## Rationale

1. **Demos reproducibles.** Una presentación grabada hoy puede
   referenciar "miren la alarma de Camión 023 con conductor Cloyd
   Schultz" y eso seguirá siendo válido en cualquier laptop con el
   código actual.

2. **Documentación con referencias estables.** DOC-10 y DOC-11
   referencian conductores y assets específicos del seed. Si los
   datos cambiaran entre corridas, la documentación quedaría
   desactualizada al instante.

3. **Bug reports inequívocos.** "El bug ocurre con Volquete 03" es
   una descripción reproducible. Si los nombres rotaran, sería
   imposible discutir bugs sin compartir dumps de DB.

4. **Tests automatizables (futuro).** Cuando lleguen los tests de
   integración (Lote 4+), el determinismo permite assertions sobre
   contenido específico (`expect(driver.name).toBe("Cloyd Schultz")`).

5. **Onboarding más simple.** Un dev nuevo que clona el repo y corre
   `npm run db:seed` ve exactamente lo mismo que el resto del equipo,
   incluyendo lo que aparece en screenshots y videos.

## El número 42

`faker.seed(42)` no es arbitrario semánticamente — es la convención
universal de "número de seed por defecto" en testing y demos
(referencia a *The Hitchhiker's Guide to the Galaxy*). Un dev nuevo lo
reconoce inmediatamente como "seed deliberado para reproducibilidad",
no como "número aleatorio".

Si en algún momento necesitamos un dataset alternativo (ej: datos de
escala de stress test), usaríamos otro número con justificación
explícita.

## Alternatives considered

### Sin seed determinístico

- **Pro:** datos "más realistas" porque cambian
- **Contra:** rompe todo lo que rationale señala arriba
- **Veredicto:** descartado · el costo de no-determinismo supera
  ampliamente el "beneficio" de variabilidad

### Seed por timestamp / hash de git commit

- **Pro:** se renueva con cada deploy
- **Contra:** sigue rompiendo reproducibilidad cross-machine, y la
  variabilidad no aporta valor real en este contexto
- **Veredicto:** descartado

### Dump de SQL fijo en lugar de seed dinámico

- **Pro:** absolutamente determinístico
- **Contra:** difícil de mantener (cualquier cambio en el schema
  rompe el dump), no aprovecha faker para generar variedad coherente
- **Veredicto:** descartado · el seed con faker.seed(42) da los
  mismos beneficios sin la rigidez

### Múltiples seeds para distintos escenarios

- **Pro:** podríamos tener "demo-base" (80 assets) y "demo-stress"
  (10000 assets)
- **Contra:** complejidad operativa innecesaria en Lote 1
- **Veredicto:** diferido · si en Lotes futuros aparece la necesidad,
  se agrega un parámetro al script

## Consequences

### Positive

- Cualquier corrida del seed produce el mismo dataset
- Documentación puede referenciar nombres y datos específicos
- Bug reports son reproducibles
- Demos consistentes cross-machine
- Onboarding visualmente predecible
- Base sólida para tests futuros

### Negative

- "Sensación" de datos repetidos si alguien corre el seed muchas
  veces. Mitigación: si necesitamos otro dataset puntual, cambiamos
  a `faker.seed(43)` con justificación explícita.
- Conductores y assets tienen los **mismos nombres** en cada demo. Un
  cliente que ve dos demos seguidas reconoce a Cloyd Schultz y Cloyd
  Schultz (potencialmente raro). Para presentaciones formales se
  podría usar otro seed con nombres pre-aprobados.

### Neutral

- El dataset es coherente pero **no real** — los nombres salen del
  pool internacional de faker. Para producción con datos reales esto
  no aplica.

## Implementation

Implementado en Sub-lote 1.2:

- `prisma/seed.ts` línea 33: `faker.seed(42);`
- `prisma/seed.ts` línea 34: `faker.setDefaultRefDate(...)`
- 3 accounts hardcoded: Transportes del Sur (40 camiones), Minera La
  Cumbre (25 mineros + silos), Rappi Cono Sur (15 motos)
- Rutas geográficas reales (Buenos Aires, Catamarca, CABA) en
  `prisma/seed-data/geo.ts`
- Distribuciones probabilísticas explícitas para status, severity,
  alarm lifecycle

## Cuándo cambiar el seed

Se puede cambiar el número del seed (ej: `42` → `123`) con justificación,
pero **debe** documentarse en este ADR como "version 2" si afecta el
dataset de demos públicos. Nunca cambiar silenciosamente.

Para datasets alternativos puntuales (testing de escala, scenarios
demo específicos), agregar un parámetro al script:

```bash
npm run db:seed -- --scenario=stress  # futuro
```

Y mantener el default en `faker.seed(42)`.
