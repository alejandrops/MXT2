# ADR-002 — Migrar a `prisma.config.ts`

**Status:** Accepted
**Date:** 2026-04-25
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator
**Supersedes:** —
**Superseded by:** —
**Context:** Sub-lote 1.6 (Polish)

## Context

En Prisma 6.19 el bloque `package.json#prisma` (donde definíamos `seed`) está
deprecated. Cada vez que corremos un comando de Prisma vemos:

```
warn The configuration property `package.json#prisma` is deprecated and will
be removed in Prisma 7. Please migrate to a Prisma config file (e.g.,
`prisma.config.ts`).
```

Además, en Sub-lote 1.2 documentamos un bug del workflow `npm run db:reset`
donde Prisma intentaba ejecutar el seed antes de aplicar las migraciones —
posiblemente relacionado al manejo de la configuración legacy.

## Decision

Migrar la configuración de Prisma de `package.json#prisma` a un archivo
`prisma.config.ts` en la raíz del proyecto.

Estructura del archivo:

```ts
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
```

Y eliminamos el bloque `"prisma"` del `package.json`.

## Rationale

1. **Future-proofing.** Prisma 7 va a eliminar el soporte para
   `package.json#prisma` completamente. Migrar ahora es trivial; migrar bajo
   presión cuando rompa la build no.

2. **Type safety.** El archivo `.ts` provee autocompletado y validación de
   tipos sobre las opciones de configuración. El JSON dentro de `package.json`
   no.

3. **Eliminar warning ruido.** Cada `prisma migrate`, cada `prisma db seed`,
   cada `prisma generate` genera el warning. Se acumula visualmente y
   distrae del output útil.

4. **Mejor encapsulación.** La configuración de Prisma deja de mezclarse con
   metadata de npm. Cada archivo tiene una sola responsabilidad.

## Alternatives considered

- **Mantener `package.json#prisma`** hasta Prisma 7: rechazado, ver arriba.
- **`prisma.config.js`** (sin TypeScript): rechazado, no aprovecha el stack
  TypeScript que ya tenemos. Type-safety es lo normal en este proyecto.

## Consequences

### Positive

- Warning deprecation desaparece de todo el output de Prisma CLI
- Configuración tipada
- Path al config explícito y fácil de extender en el futuro
  (datasource overrides para dev/test, schema multi-archivo, etc.)
- Reduce el ruido durante demos en pantalla compartida

### Negative

- Un archivo más en la raíz del proyecto
- Si en algún momento queremos revertir (no parece probable), hay que
  recrear el bloque en `package.json`

### Neutral

- No hay impacto en runtime ni en el shape de la DB
- No hay impacto en los scripts de npm

## Implementation

- Archivo nuevo: `prisma.config.ts` en la raíz
- Eliminado: bloque `"prisma": { ... }` de `package.json`
- Verificación: corriendo cualquier comando de Prisma ya no aparece el
  warning de deprecation
