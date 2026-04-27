# ADR-005 — Server Components first

**Status:** Accepted
**Date:** 2026-04-25
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator
**Supersedes:** —
**Superseded by:** —
**Context:** Lote 1 evidence (Next.js 15 App Router)

## Context

Next.js 15 introduce React Server Components (RSC) como default. Cada
componente puede ser:

- **Server Component** — renderiza en el server, sin JS al browser, lee
  data directamente con `await db.query()`
- **Client Component** — renderiza en el browser (con JS), tiene
  `useState`, `useEffect`, event handlers

Sin reglas claras, los devs tienden a poner `"use client"` por defecto
"por las dudas" (familiar de versiones anteriores). Eso anula los
beneficios de RSC: el bundle crece, el TTFB empeora, y la base de datos
queda atrás de un fetch HTTP en lugar de una consulta directa.

## Decision

**Por defecto, todos los componentes son Server Components. Un componente
solo se marca `"use client"` cuando cumple al menos una de estas
condiciones:**

1. Necesita state local (`useState`, `useReducer`)
2. Necesita event handlers (`onClick`, `onChange`, `onSubmit`)
3. Usa hooks de React que requieren browser (`useEffect`, `useRef`,
   `useTransition`, `useRouter`)
4. Usa APIs del browser (`window`, `document`, `localStorage`)
5. Usa libraries que dependen de DOM (Leaflet, charts, mapas)

**Si ninguna de las condiciones aplica → es Server Component, fin.**

## Rationale

1. **Performance.** Un Server Component no manda JS al browser. Una lista
   de 25 assets con AssetTable + AssetEventCard puro en Server reduce
   ~30KB de bundle vs hacer todo Client.

2. **Acceso directo a la DB.** En Server Components hacés
   `const data = await listAssets(...)` — una sola query al server,
   resultado en HTML. En Client Components tenés que crear un endpoint
   API + fetch + loading state + error state. 5x más código.

3. **SEO y first paint.** El HTML llega completo desde el server,
   incluyendo las primeras 25 alarms del Dashboard. Sin spinners
   iniciales.

4. **Streaming nativo.** Server Components pueden usar React Suspense
   para streamear secciones a medida que sus queries terminan, sin
   esperar a la pantalla entera.

5. **Menos abstracciones.** No hay que armar un cliente HTTP, manejar
   estados de loading, retry, etc. Para CRUD simple, Server Component +
   `useTransition` cubre el 80% de los casos.

## Cuándo SÍ usar Client Component

Documentamos los casos explícitos para evitar el reflejo de
"`use client` por las dudas":

- **Forms con validación:** estado local del input antes de submit
- **Búsqueda con typing:** state local del search hasta que commitea
- **Maps interactivos:** Leaflet/Mapbox tocan `window`
- **Drag-and-drop:** event handlers + state
- **Toasts y modals:** estado de visibilidad
- **Tooltips:** event handlers de hover/focus
- **Charts interactivos:** la mayoría requieren DOM

## Cuándo NO usar Client Component

Errores comunes que evitamos:

- ❌ Una página que recibe `searchParams` y hace fetch → **Server**, no
  Client
- ❌ Una tabla con sort que se hace via Link → **Server**, no Client
- ❌ Una paginación con Links → **Server**, no Client
- ❌ Un dashboard con KPIs precomputados → **Server**, no Client
- ❌ "Voy a usar `useEffect` para fetch" → si es fetch inicial, es
  Server con `await`

## Alternatives considered

- **Client-first (default Next.js < 13):** rechazado. Pierde todos los
  beneficios de RSC.

- **Render in Server, hydrate full Client:** equivale a Client Components
  con SSR. Anti-pattern actual de RSC.

- **Service-worker / edge cache:** complementario, no reemplaza la
  decisión Server vs Client del componente.

## Consequences

### Positive

- Bundle más chico, performance mejor
- Acceso directo a DB sin endpoint intermedio
- Menos código para casos simples (CRUD, listas, dashboards)
- Streaming + Suspense disponibles
- Mental model claro para devs nuevos

### Negative

- Curva de aprendizaje: "¿esto se puede en Server?" es la pregunta
  recurrente. Mitigación: ADR documenta los casos.
- Algunos components Client necesitan **dos archivos** (wrapper +
  inner) para combinar dynamic import + ssr:false (ver ADR-007). Es
  trade-off aceptable.
- Devs migrando de Pages Router pueden caer en `useEffect + fetch`.
  Code review tiene que detectar.

### Neutral

- La división Server/Client ocurre **en cada archivo individual**, no
  en folders. El barrel `index.ts` exporta ambos tipos juntos.

## Implementation · auditoría Lote 1

De los 15 componentes del Lote 1, **solo 3 son Client**:

| Componente | Client? | Razón |
|---|---|---|
| KpiTile | Server | Solo recibe props y renderiza |
| StatusPill | Server | Solo recibe props |
| SectionHeader | Server | Solo recibe props |
| Tabs | Server | Solo recibe props, los Links son nativos |
| **LeafletMap** | **Client** | Wrapper con `dynamic({ ssr: false })` (ADR-007) |
| **LeafletMapInner** | **Client** | Usa `useMap`, toca window |
| AlarmCard | Server | Solo recibe props, el Link es nativo |
| DriverScoreCard | Server | Solo recibe props |
| AssetEventCard | Server | Solo recibe props |
| EventRow | Server | Solo recibe props |
| AssetTable | Server | Server-rendered table, links nativos |
| SortHeader | Server | Genera Links pre-built |
| Pagination | Server | Genera Links pre-built |
| **AssetFilterBar** | **Client** | Search input con state, `useRouter`, `useTransition` |
| AssetHeader | Server | Solo recibe props |

12 Server / 3 Client. La proporción 80/20 es exactamente lo esperado por
este ADR.

Páginas (`app/seguridad/page.tsx`, `app/seguridad/assets/page.tsx`,
`app/seguridad/assets/[id]/page.tsx`) — **todas Server**, hacen `await`
de queries directamente.

## Workflow para componentes nuevos

```
1. Empezás a escribir el componente
2. ¿Necesita useState / useEffect / event handler / window?
   ├─ NO  → Server Component. No agregues "use client".
   └─ SÍ → Client Component. Agrega "use client" en la primera línea.
3. Code review verifica que el "use client" tiene justificación.
```

Si en review aparece un `"use client"` sin razón clara, se elimina y se
re-evalúa.
