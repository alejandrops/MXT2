# ADR-013 · PostHog instrumentación MVP

**Status:** Accepted
**Date:** 2026-05-02
**Lote:** L6
**Decision-makers:** Alejandro (PO), Claude (orquestador de desarrollo)

## Contexto

Maxtracker está cerca del MVP soft-launch. Necesitamos visibilidad sobre:
- Qué pantallas se usan vs cuáles no (decidir feature priorities)
- Funnels críticos (login → mapa → alarma_attended)
- Drop-offs en flujos (dónde abandonan los users)
- Retention diaria/semanal por cuenta (early signal de NPS)

Sin instrumentación desde día 1, perdemos información valiosa de los primeros usuarios reales.

## Decisión

Adoptar PostHog (cloud, free tier inicial) como producto de analytics. Razones:

- **Self-hostable a futuro** · si crecemos y los costos aprietan, podemos mover a un PostHog self-hosted (no es un lock-in fuerte como Amplitude o Mixpanel).
- **Funnels + session replay + dashboards en una sola herramienta** · evita stack fragmentado.
- **Free tier generoso** · 1M eventos/mes, suficiente para MVP.
- **SDK liviano para Next.js** · `posthog-js` ~30KB gzipped.

Se descartó Amplitude (más caro, peor DX), Mixpanel (UI menos pulida), Fathom (solo pageviews, no funnels), GA4 (privacy concerns + UI horrible para análisis profundo).

## Diseño

### Capa de abstracción

`src/lib/analytics/posthog.ts` envuelve el SDK con:

1. **Type-safety** · `EventMap` es la única fuente de verdad de eventos válidos. Llamar `track("nombre_que_no_existe", {...})` rompe el typecheck. Refactor-friendly.
2. **Graceful degradation** · si no hay key, todas las funciones son no-op. Permite mergear el código antes de configurar la cuenta.
3. **Privacy hard-coded** · `mask_all_text: false` solo porque maskeamos nosotros NO trackeando inputs/PII en code. Session replay disabled by default.
4. **Modo demo no trackea** · evita pollute analytics con datos de testing.

### Provider en layouts

`PostHogProvider` (Client Component) se monta en `(product)/layout.tsx` y `admin/layout.tsx`. Recibe `userTraits` desde el server (no hace fetch client-side de la session).

Tres efectos:
- Init del SDK (idempotente)
- `identify()` con traits estructurales
- `capturePageView()` en cada cambio de pathname o searchParams

### Privacy

**Lo que SÍ se manda:**
- userId (cuid)
- accountId (cuid o null)
- profileLabel ("Operador", "Cliente Admin", etc.)
- accountTier ("BASE" | "PRO" | "ENTERPRISE" | null)
- assetId, alarmId, etc. (IDs internos)
- Booleans / enums de eventos (success/failed, severity, format)

**Lo que NUNCA se manda:**
- Email, nombre, apellido del user
- Patente del vehículo
- Document number
- Phone
- Cualquier input que el user escriba (search queries, comments, etc.)
  - Excepción · cmdk_searched solo manda `queryLength`, no el contenido

Esta política NO depende de configuración de PostHog · está en el código, donde es más fácil de auditar.

## Eventos definidos en MVP

`EventMap` declara 13 eventos. En este lote se activan call-sites de:
- `user_login` (success | failed) → `LoginForm.handleSubmit`
- `$pageview` (auto · cada nav del App Router)

El resto está declarado pero pendiente de call-site. Lotes futuros los activan progresivamente:
- `alarm_attended/closed` → modales de Torre de Control
- `vehicle_view` → detail pages
- `report_generated` → /reportes
- `export_clicked` → botones de export
- `theme_changed` → ThemeProvider
- `cmdk_opened/searched` → CommandPalette
- `account_switched` → Topbar identity switcher

## Setup operacional

**De Alejandro:**
1. Crear cuenta en posthog.com (US region)
2. Copiar Project API Key
3. Agregar `NEXT_PUBLIC_POSTHOG_KEY` y `NEXT_PUBLIC_POSTHOG_HOST` a `.env.local` y Vercel
4. Re-deploy

**Sin estos pasos** · código compila y corre, no hay errores, simplemente no llegan eventos a PostHog. Esto es intencional · permite mergear el lote sin bloquear por config externa.

## Consecuencias

### Positivas

- Dashboard de uso real desde el primer login en producción.
- Type-safe events → refactor sin miedo, autocompletado en IDE.
- Privacy auditable en código, no en config remota.
- Free tier cubre MVP por meses.

### Negativas

- **Dependencia adicional** · `posthog-js` ~30KB gzipped en el bundle del cliente. Aceptable.
- **Vendor lock-in light** · si decidimos migrar, cambiar el wrapper es 1 archivo. Migración completa de eventos históricos a otra plataforma es más complejo.
- **El identify expone IDs internos** · si un actor obtiene acceso al dashboard de PostHog, ve la estructura de cuentas. PostHog tiene SOC2 / GDPR compliance, mitigación aceptable.

### Nulas

- No afecta runtime de pages que no usen analytics.
- No requiere migration de DB.
- No cambia comportamiento del modo demo.

## Validación

```bash
# Sin key (esperado: no errores, no network)
npm run dev
# abrir DevTools, navegar, verificar Network: no hay calls a posthog.com

# Con key (después de config)
# 1. agregar NEXT_PUBLIC_POSTHOG_KEY a .env.local
# 2. npm run dev
# 3. login + nav + ver eventos en PostHog dashboard "Live events"
```

## Referencias

- HANDOFF.md · BLOQUE 2 · L6 PostHog instrumentación
- https://posthog.com/docs/libraries/next-js (App Router setup)
- https://posthog.com/docs/privacy (compliance)
