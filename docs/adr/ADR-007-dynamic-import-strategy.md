# ADR-007 — Dynamic import para libs SSR-incompatibles

**Status:** Accepted
**Date:** 2026-04-25
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator
**Supersedes:** —
**Superseded by:** —
**Context:** Sub-lote 1.5 (Libro B con mini-mapa Leaflet)

## Context

Algunas libraries de UI manipulan el DOM directamente y dependen de
`window`, `document` u objetos del browser. En un setup SSR (Next.js),
intentar evaluar ese código en el server crashea la renderización.

Casos típicos:

- **Leaflet** (mapas) — usa `window` para detectar capabilities, crea
  divs y eventos al instanciar
- **Chart.js / Recharts (algunos modos)** — Canvas API
- **Editores ricos (Quill, TinyMCE)** — DOM-heavy
- **Drag-and-drop libs (React-DnD, dnd-kit con HTML5 backend)** —
  HTML5 drag API
- **Libraries de autenticación (Auth0 SDK)** — `window.location`,
  `localStorage`

Cuando intenté usar `react-leaflet` directamente en un Server Component
durante Sub-lote 1.5, el build falló con
`ReferenceError: window is not defined`.

## Decision

**Para cualquier library que toque `window`, `document` u otros browser
APIs, usar el pattern de dos archivos: wrapper público con dynamic
import + ssr:false, y archivo Inner con la implementación real.**

Estructura canónica:

```
src/components/maxtracker/
├── LeafletMap.tsx         ← wrapper público, "use client"
└── LeafletMapInner.tsx    ← implementación real, "use client"
```

### Wrapper público (LeafletMap.tsx)

```tsx
"use client";

import dynamic from "next/dynamic";

const Inner = dynamic(
  () => import("./LeafletMapInner").then((m) => ({ default: m.LeafletMapInner })),
  {
    ssr: false,
    loading: () => <div>Cargando mapa…</div>,
  },
);

export function LeafletMap(props) {
  return <Inner {...props} />;
}
```

### Inner (LeafletMapInner.tsx)

```tsx
"use client";

import { MapContainer, ... } from "react-leaflet";
import L from "leaflet";
// ... resto de la lib que toca window
```

Uso desde una page (Server Component):

```tsx
// page.tsx (Server Component)
import { LeafletMap } from "@/components/maxtracker";

export default async function Page() {
  const data = await fetchData();
  return <LeafletMap lat={data.lat} lng={data.lng} />;
}
```

La page sigue siendo Server Component. El mapa se carga en el browser
solamente.

## Rationale

1. **Separación de SSR y client logic.** El wrapper es seguro de
   importar desde Server Components porque solo declara un dynamic
   import. La lib real solo se evalúa en el browser.

2. **Loading state explícito.** El `loading:` del dynamic import
   muestra un placeholder mientras la lib baja por la red. Sin él, el
   espacio queda vacío durante 200-500ms.

3. **Bundle splitting automático.** Next.js crea un chunk separado para
   la lib pesada. Solo se descarga en las páginas que la usan, no en
   todas.

4. **Patrón replicable.** Cualquier futura library SSR-incompatible
   sigue el mismo molde de dos archivos.

5. **Server Components siguen siendo el default** (ADR-005). El wrapper
   es Client por necesidad técnica, pero las páginas que lo consumen
   permanecen Server.

## Cuándo aplicar este patrón

| Library | Aplicar? | Razón |
|---|---|---|
| Leaflet, Mapbox GL | **Sí** | Tocan window al inicializar |
| Chart.js (Canvas mode) | **Sí** | Canvas API |
| Recharts | No (es SSR-safe en general) | Pure SVG, sin window |
| Tone.js, audio libs | **Sí** | AudioContext en window |
| Code editors (Monaco, CodeMirror) | **Sí** | Heavy DOM |
| react-dnd con HTML5 backend | **Sí** | DataTransfer API |
| dnd-kit (default) | No | SSR-safe by design |
| Auth0 SPA SDK | **Sí** | window.location |
| Stripe Elements | **Sí** | DOM heavy |

**Regla práctica:** si la documentación de la lib menciona "browser
only", "client-side", "requires window", o si la lib tiene mucho `if
(typeof window !== 'undefined')` en su código, va con dynamic import +
ssr:false.

## Alternatives considered

- **`if (typeof window !== 'undefined')` checks dispersos:** rechazado.
  Cada componente tiene que recordar el guard, fácil olvidar uno y que
  aparezca el error en producción.

- **Marcar la página entera como Client Component:** rechazado. Anula
  ADR-005, perdés el server fetch directo, performance peor.

- **Lazy boundary con React.lazy + Suspense:** funciona pero requiere
  más boilerplate. `dynamic({ ssr: false })` de Next.js es más limpio.

- **Hacer fetch del mapa en useEffect:** anti-pattern. El componente
  tiene que existir para que useEffect corra; el problema no es
  fetching de datos, es ejecución del código de la lib.

## Consequences

### Positive

- Pattern replicable y documentado para libs futuras
- Las páginas siguen siendo Server Components
- Bundle splitting "gratis" para libs pesadas
- Loading state explícito y customizable

### Negative

- **Dos archivos por componente** que use lib SSR-incompatible.
  Trade-off aceptable para la pequeña cantidad de casos esperados.
- El "Inner" puede sentirse como ruido si la lib es chica. Para libs
  triviales se puede colapsar en un único archivo (ver más abajo).
- Hydration mismatch warnings ocasionales del lado de Leaflet — son
  inocuas y se ignoran.

### Neutral

- El usuario ve "Cargando mapa…" durante ~200ms la primera vez. En
  visitas posteriores el chunk está cacheado y es instantáneo.

## Variante minimalista (un solo archivo)

Para libs muy chicas que no justifican un Inner separado, se puede
inlinearlo:

```tsx
"use client";
import dynamic from "next/dynamic";

const TinyChart = dynamic(
  () => import("./tiny-chart").then((m) => m.TinyChart),
  { ssr: false }
);

export function MyChart(props) {
  return <TinyChart {...props} />;
}
```

Pero la regla por defecto sigue siendo **dos archivos** porque escala
mejor cuando la lib crece.

## Implementation

Implementado en Sub-lote 1.5:

- `src/components/maxtracker/LeafletMap.tsx` — wrapper público
- `src/components/maxtracker/LeafletMapInner.tsx` — implementación real
- `src/app/seguridad/assets/[id]/page.tsx` — Server Component que usa
  `<LeafletMap />` sin tocar leaflet directamente

Detalle adicional documentado en
`docs/design-system/components.md` § LeafletMap.
