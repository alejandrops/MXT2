# Maxtracker · Analytics · PostHog events & funnels

> Última actualización: S1-L9 (Sprint 1 · cierre)
> Wrapper: `src/lib/analytics/posthog.ts`
> Provider: `src/components/analytics/PostHogProvider.tsx`

## Filosofía

PostHog se usa para entender **comportamiento agregado** del producto · qué módulos se usan, qué flows funcionan, dónde se atascan los testers. Todo eventos van por `track()` (type-safe) y nunca incluyen PII (email/nombres).

**Modos de operación:**
- `authMode === "demo"` → SDK no inicializa · no hay tráfico
- Sin `NEXT_PUBLIC_POSTHOG_KEY` → SDK queda en no-op · no rompe deploys
- `NEXT_PUBLIC_ENABLE_SESSION_REPLAY === "1"` → activa session recording opt-in

## Catálogo de eventos

Definidos en `EventMap` (`src/lib/analytics/posthog.ts`).

### Auth
- `user_login` · success, profileLabel, reason
- `user_logout`
- `account_switched` · from, to (Super Admin switch entre cuentas)

### Command palette
- `cmdk_opened`
- `cmdk_searched` · queryLength

### Alarmas / seguridad
- `alarm_attended` · alarmId, severity
- `alarm_closed` · alarmId, resolution

### Libro del Objeto
- `vehicle_view` · assetId, source ("list" | "map" | "search" | "cmdk")
- `book_tab_changed` · objectType, fromTab, toTab

### Reportes / boletín
- `report_generated` · type, period, metric
- `boletin_viewed` · period, source ("snapshot" | "onDemand")
- `export_clicked` · format ("csv" | "pdf" | "excel")

### Configuración
- `theme_changed` · mode
- `password_set_for_user` · targetUserId

### Feedback widget (S1-L8)
- `feedback_opened`
- `feedback_submitted` · category, messageLength
- `feedback_dismissed` · hadDraft

### Session replay (S1-L9)
- `session_recording_paused`
- `session_recording_resumed`

## Funnels recomendados

Configurar estos funnels en PostHog → Insights → Funnels.

### F1 · Onboarding del tester
Pregunta · ¿los testers exploran las pantallas clave en su primera sesión?

```
1. user_login                              (success: true)
2. $pageview                               (path: /seguimiento/mapa)
3. vehicle_view                            (cualquier source)
4. book_tab_changed                        (cualquier toTab)
5. feedback_opened                         (engagement con el widget)
```

KPI · % que llega al paso 5 en su primera sesión. Target: > 60%.

### F2 · Adopción del Libro del Objeto
Pregunta · ¿los users entienden el modelo del Libro?

```
1. vehicle_view                            (source: cualquiera)
2. book_tab_changed                        (toTab: telemetria | conductores | actividad)
3. book_tab_changed                        (segunda interacción · indica exploración real)
```

KPI · ratio de users que llegan al paso 3 / paso 1. Target: > 40%.

### F3 · Feedback engagement
Pregunta · ¿los users que abren el widget terminan enviando?

```
1. feedback_opened
2. feedback_submitted
```

KPI · conversion rate. Target: > 50% (un drop muy grande indica friction en el form).

### F4 · Boletín pre-generado
Pregunta · ¿el cron está funcionando? ¿Los users acceden a snapshot vs on-demand?

```
1. boletin_viewed                          (source: "onDemand")
   → debería bajar con el tiempo
2. boletin_viewed                          (source: "snapshot")
   → debería ser la mayoría
```

KPI · ratio snapshot / total. Target: > 80% una vez activo el cron.

## Cohorts

### Testers activos
- Filter: usuarios con `$pageview` en los últimos 7 días
- Filter: profileLabel ∈ {OPERATOR, CLIENT_ADMIN}

### Power users
- Filter: usuarios con > 50 `vehicle_view` en últimos 30 días
- Útil para entender adopción profunda y reclutar para entrevistas

## Privacidad y session replay

### Lo que SÍ enviamos
- IDs · userId, accountId
- Atributos estructurales · profileLabel, accountTier
- Eventos custom con datos no-sensitivos (alarmId, period, etc)
- Session recording (si activo) con masking de inputs sensibles

### Lo que NO enviamos
- Email del user
- Nombre/apellido
- Datos de vehículos individuales con identificadores reales del cliente
- Mensajes del feedback widget (van solo a la DB de Maxtracker, no a PostHog)

### Activar session replay
1. Setear env var `NEXT_PUBLIC_ENABLE_SESSION_REPLAY=1` en Vercel
2. Banner `SessionRecordingNotice` aparece bottom-left avisando al user
3. User puede pausar desde el banner · estado persiste en localStorage
4. Eventos `session_recording_paused/resumed` permiten medir opt-out rate

### Compliance
- Activar session replay solo en builds de tester / beta
- En producción para clientes finales · pedir opt-in explícito en /configuracion (próximo lote)
- GDPR/LGPD · el banner persistente cumple con "claramente avisar antes de procesar"

## Cómo agregar un evento nuevo

1. Editar `src/lib/analytics/posthog.ts` · agregar key+shape al `EventMap`
2. Importar en el componente client: `import { track } from "@/lib/analytics/posthog"`
3. Llamar: `track("nuevo_evento", { campo: valor })`

TypeScript valida que el name y los props matchean el EventMap · refactor-friendly.
