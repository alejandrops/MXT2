# Architecture Decision Records · Maxtracker

Esta carpeta contiene los **ADRs** (Architecture Decision Records) de Maxtracker · documentos formales de decisiones arquitectónicas significativas.

## ¿Qué es un ADR?

Un ADR captura **una decisión arquitectónica importante**, su contexto, las opciones consideradas y las consecuencias. Es la herramienta estándar para preservar el "por qué" detrás del "qué" del código.

Referencias:
- Michael Nygard · [*Documenting Architecture Decisions*](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- MADR template · https://adr.github.io/madr/

## Cuándo escribir un ADR

- La decisión afecta múltiples componentes del sistema
- Hay trade-offs no obvios entre opciones
- La decisión es difícil de revertir
- El equipo necesitará revisar el "por qué" en 6+ meses
- Cierra un blocker identificado en una auditoría (ej. AG-008)

## Status posibles

| Status | Significado |
|---|---|
| **Proposed** | Borrador · en revisión |
| **Accepted** | Decidido · activo |
| **Deprecated** | Ya no aplica · ver "Superseded by" |
| **Rejected** | Considerado y descartado |

## Índice de ADRs

| # | Título | Status | Fecha | AG-008 |
|---|---|---|---|---|
| [001](./ADR-001-multi-tenancy-isolation.md) | Multi-tenancy isolation | Accepted | 2026-05-06 | ✅ Cierra issue #2 |
| [002](./ADR-002-background-jobs.md) | Background jobs architecture | Accepted | 2026-05-06 | ✅ Cierra issue #3 |
| 003 | Pipeline TCP de ingestión | Proposed | — | 🟡 Cierra issue #1 |
| 004 | Estrategia de tests | Proposed | — | — |
| 005 | Observabilidad y logging | Proposed | — | — |

## Convención de naming

```
ADR-{NNN}-{kebab-case-title}.md
```

Donde `NNN` es el número correlativo (zero-padded) y el título es descriptivo y corto.

## Estructura recomendada

Cada ADR debe tener al menos:

1. **Header** · status, date, deciders, supersedes
2. **Contexto y problema**
3. **Drivers de la decisión**
4. **Opciones consideradas** (al menos 2)
5. **Decisión** · cuál y por qué
6. **Consecuencias** · positivas, negativas, neutras
7. **Implementation roadmap** · si aplica
8. **Compliance y verificación** · si aplica
9. **Referencias**

Ver `ADR-001` como ejemplo de documento completo.
