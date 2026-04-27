# ADR-006 — CSS Modules + design tokens vs Tailwind

**Status:** Accepted
**Date:** 2026-04-25
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator
**Supersedes:** —
**Superseded by:** —
**Context:** ADR-000 (decisión inicial) + Lote 1 evidence

## Context

ADR-000 ya estableció el stack inaugural (Next.js + Prisma + SQLite +
**CSS Modules**). Este ADR elabora específicamente la decisión de
styling, porque es una de las que más impacto tiene en la velocidad de
desarrollo y la consistencia visual.

Las opciones evaluadas fueron:

1. **CSS Modules + variables CSS** (lo que adoptamos)
2. **Tailwind CSS** (la opción más popular en 2025)
3. **CSS-in-JS** (styled-components, emotion)
4. **Vanilla Extract** / **PandaCSS** (typed CSS-in-CSS)

## Decision

**CSS Modules con variables CSS (`var(--token)`) declaradas en
`globals.css`.**

Patrón:

```css
/* globals.css */
:root {
  --red: #E8352A;
  --fs-card-title: 13px;
  --pad-card: 10px 12px;
}
```

```tsx
/* AlarmCard.tsx */
import styles from "./AlarmCard.module.css";
export function AlarmCard() {
  return <div className={styles.card}>...</div>;
}
```

```css
/* AlarmCard.module.css */
.card {
  padding: var(--pad-card);
  background: var(--sf);
  font-size: var(--fs-card-title);
}
```

Sin Tailwind. Sin CSS-in-JS. Sin librerías de utility classes.

## Rationale

1. **Tokens semánticos vs utility classes.** El sistema visual de
   Maxtracker se basa en **6 paletas semánticas** (red, ora, grn, blu,
   tel, pur) con tríadas (color/bg/text/border). En Tailwind eso
   requiere customizar el theme y crear classes personalizadas igual.
   Con CSS variables, la semántica vive en el nombre del token
   (`--red-bg`), no en el HTML.

2. **El producto está cargado de variables sutiles.** `--fs-card-title:
   13px`, `--pad-card: 10px 12px`, `--brd: #CDD0D5`. Esos valores no son
   estándar de Tailwind y crear utilities equivalentes (`px-cardx`,
   `text-card-title`) es más fricción que valor.

3. **Densidad enterprise.** Tailwind es excelente para velocidad
   prototipo y aplicaciones B2C con espaciado generoso. Maxtracker está
   en el extremo opuesto: densidad alta, valores ajustados, padding
   `10px 12px` (no `2 3` ni `8 12`). Pelear contra los defaults de
   Tailwind para llegar al estilo SCADA cuesta más.

4. **Co-localización del estilo con el componente.** Un archivo
   `AlarmCard.module.css` al lado de `AlarmCard.tsx` es mentalmente
   simple. Cuando borrás el componente, borrás los estilos. Sin
   leftovers.

5. **Bundle predecible.** Cada componente carga su CSS en el bundle de
   la página que lo usa. Sin tree-shaking de utilities, sin runtime CSS
   injection. El comportamiento es transparente.

6. **Cero runtime.** A diferencia de styled-components o emotion, no hay
   código JS de styling ejecutándose. Es solo CSS estático.

7. **Prepara para variants futuras.** Cuando lleguemos a dark mode
   (Lote 4+), un solo override de las variables CSS (ej:
   `[data-theme="dark"]`) cambia todo el sistema. En Tailwind requiere
   reescribir clases con `dark:` prefix.

## Alternatives considered

### Tailwind CSS

- **Pro:** velocidad inicial, excelente DX para prototipos, comunidad,
  copy-paste de componentes
- **Contra:** customizar theme para 6 paletas + tokens específicos del
  dominio termina siendo más código que CSS Modules; HTML pesado de
  classes; pelea contra densidad enterprise
- **Veredicto:** descartado por mismatch con el target visual

### CSS-in-JS (styled-components, emotion)

- **Pro:** dinamismo (styles dependientes de props)
- **Contra:** runtime cost, conflictos con React Server Components (el
  styling se ejecuta en cliente), hidratación más lenta
- **Veredicto:** descartado · incompatible con ADR-005 (Server
  Components first)

### Vanilla Extract / PandaCSS

- **Pro:** type-safety en estilos (autocomplete, errores en CSS
  references)
- **Contra:** capa adicional de tooling, build step custom, comunidad
  más chica, learning curve
- **Veredicto:** descartado por madurez · si en Lote 4+ hay caso fuerte
  para typed styling, se reconsidera

### Tailwind + CSS variables (híbrido)

- **Pro:** mejor de ambos mundos según los proponentes
- **Contra:** dos sistemas paralelos que requieren conocimiento de
  ambos · ningún caso real lo justifica para este producto
- **Veredicto:** descartado por complejidad

## Consequences

### Positive

- Tokens semánticos en lugar de utility classes
- Co-localización archivo CSS con componente
- Cero runtime de styling
- Compatible con Server Components nativamente
- Switch a dark mode futuro = override de un set de variables
- Curve más leve para devs sin experiencia Tailwind

### Negative

- Cada componente nuevo requiere crear 2 archivos (`.tsx` + `.module.css`)
- No hay autocomplete de classes como en Tailwind con plugins
- Velocidad inicial de prototipo es algo menor que Tailwind
- Devs nuevos que vienen de Tailwind necesitan adaptación

### Neutral

- El tamaño del bundle es similar (Tailwind con purge ≈ CSS Modules sin
  duplicación)

## Reglas de uso

### Sí

- Usar `var(--token)` para todo color, fontSize, padding, gap, radius
- Crear un `Component.module.css` por cada componente
- Mantener nombres de classes minúsculas o camelCase (`.card`, `.kpiStrip`)
- `@media` queries dentro del module con breakpoints de tokens.md

### No

- Inline styles con valores literales (`style={{ color: "#E8352A" }}`)
- Importar globals.css en componentes (ya está cargado en layout)
- Usar `:global()` salvo en utilities exclusivas (`.dotSep`, `.ico`)
- Cambiar valores de tokens en lugar de crear nuevos cuando hace falta

### Excepción válida: inline style con var()

```tsx
{/* OK porque usa token */}
<div style={{ color: "var(--t3)" }}>...</div>

{/* NO OK · valor literal */}
<div style={{ color: "#9CA3AF" }}>...</div>
```

Inline con `var(--token)` se permite cuando es valor muy puntual y
crear un `.module.css` separado es overkill.

## Implementation

Ya implementado en Lote 1. Toda la estructura visible en:

- `src/app/globals.css` — definición de tokens y reset
- `src/components/maxtracker/*.module.css` — 15 archivos de estilos
- `src/app/**/page.module.css` — estilos de pages

Documentación detallada en `docs/design-system/tokens.md`.

## Cuándo reconsiderar

Este ADR se reconsidera si:

- Aparece la necesidad de **temas múltiples por account** (white-label)
  con valores totalmente diferentes (no solo dark mode)
- El tamaño del bundle CSS supera 100KB y el purge se vuelve necesario
- Llega un equipo grande (10+ devs) sin experiencia previa en CSS
  Modules y la velocidad de adopción se vuelve un problema
