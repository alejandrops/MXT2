# Maxtracker · HANDOFF v3
## Cierre Sprint 1 · estado para próxima sesión

**Fecha:** 2026-05-04
**Versión anterior:** HANDOFF v2 (`/mnt/user-data/uploads/HANDOFF-v2.md`)
**Sprint cerrado:** 1 · 10 lotes entregados, todos aplicables en cadena, idempotentes, typecheck 0
**Pendiente:** Sprint 2 (refactor `loadBoletinData` para cron real + integración mail Resend)

---

## 0 · Producto y stack (sin cambios desde v2)

**Maxtracker** · plataforma B2B SaaS IoT de telemática para flotas LATAM (Argentina/Chile inicial). Reemplaza producto existente del PO Alejandro Sánchez.

**Stack:**
- Next.js 15.5 / React 19 / TypeScript strict
- tRPC / Prisma 6.19.3 / Postgres en Supabase (`aws-1-sa-east-1`)
- Vercel `gru1` / dominio `mxt-2.vercel.app`
- Mapas Leaflet 1.9 + OpenStreetMap
- Excel via exceljs · Recharts 2.15
- PostHog (events + session replay opt-in)
- Telemática Teltonika (FMC003 / FMC130 / FMB920 / Legacy)

**Repo:** `github.com/alejandrops/MXT2` branch `main` (público)
**Sandbox:** `/home/claude/repo/maxtracker-functional/`
**Local PO:** `~/Downloads/maxtracker-functional`

**Filosofía:** Tufte (color solo en anomalías) · Samsara/Geotab/HubSpot UX · Spanish working language · brutal honesty preferida.

---

## 1 · Convenciones de sesión (mantener)

### Modo bulk
- "Termina de darme todo y después testeamos"
- PO interrumpe poco · "segui" = "producí el siguiente lote sin más preguntas"
- Brutal honesty preferido sobre diplomacia · Claude recomienda y espera confirmación solo si hay decisión grande

### Metodología de lotes
Cada lote es un **zip con `apply.sh` + carpeta `_payload/`**.

**Patrón apply.sh idempotente:**
```bash
apply_file() {
  local rel="$1"
  local src="$PAYLOAD/$rel"
  local dst="$rel"
  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"  # nuevo
  elif cmp -s "$src" "$dst"; then
    : # sin cambios
  else
    cp "$src" "$dst"  # actualizado
  fi
}
```

Soporta también deletes via `_delete.txt` (ver L2 ia-reorg).

### Comando estándar de aplicación al final de cada mensaje
```bash
cd ~/Downloads
unzip -oq <ZIP>.zip -d maxtracker-functional
(cd maxtracker-functional && bash apply.sh)
cd maxtracker-functional && rm -rf .next && npm run dev
```

### Verificación pre-empaquetado obligatoria
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l   # debe ser 0
```

### Test e2e en cada cierre
- Clone fresh GitHub `main`
- Aplicar todos los lotes en cadena
- Re-aplicar último (idempotencia · debe reportar todos "sin cambios")
- Typecheck final 0 errores

### Deploy
```bash
git add -A
git commit -m "<lote-name> · <descripción>"
git push origin main
```

Vercel hace auto-deploy en push a `main`.

### @ts-nocheck
47 archivos tienen `// @ts-nocheck · pre-existing` por desfase del Prisma client. **NO arreglar caso por caso** · cleanup masivo programado para Sprint 6 según HANDOFF v2.

---

## 2 · Sprint 1 · 10 lotes entregados

Todos los zips viven en `/mnt/user-data/outputs/` (en la sesión que los generó). El PO los tiene aplicados en su sandbox local. Detalle de cada lote:

### L1 · `S1-L1-fixes` (5 archivos · ~19KB)
**Bugs visuales:**
- F1 · Mapa `FleetMap.tsx` · auto-fit reactivo al cambio de SET de IDs visibles + soft-follow del seleccionado vía `panTo` (sin tocar zoom)
- F2 · Selector fecha `DayWithTimePicker.module.css` · `flex-direction: row` (era column legacy)
- F3 · Boletín · `ExportMenu` extendido con `onPrintDocument` · `BoletinHeader` reemplaza 2 botones por 1 dropdown

### L2 · `S1-L2-ia-reorg` (15 nuevos/actualizados + 7 deletes · ~28KB)
**Reorganización IA:**
- Mover `/actividad/scorecard` → `/conduccion/scorecard` (con redirect que preserva searchParams)
- Renombrar `/direccion/distribucion-grupos` → `/direccion/comparativa-objetos`
- Eliminar `/direccion/vista-ejecutiva` (mal hecha) → redirect a `/dashboard`
- Crear `/dashboard/page.tsx` scaffold (home cross-módulo)
- Sidebar reorganizado · Conducción solo con Scorecard, Dirección sin Vista Ejecutiva, brand→`/dashboard`
- Topbar agrega icono Home → `/dashboard`

### L3 · `S1-L3-mock-can` (3 nuevos + 4 actualizados · ~25KB)
**Datos demo CAN bus FMC003:**
- Módulo `src/lib/mock-can/` con generador determinístico (FNV-1a hash + mulberry32 PRNG)
- 80% flota tiene CAN (70% FMC003 + 10% FMC130) · 20% sin CAN (12% FMB920 + 8% Legacy)
- Genera: RPM (curva no-lineal por marcha), engineTempC, oilPressureKpa, fuelLevelPct (decay diario), fuelConsumptionLper100km (bimodal heavy 2.5-6.5 km/L vs liviano 7-13 km/L · 60/40), odometerKm, engineHours, idleSecondsToday, ptoActive, doorOpen, seatbeltOk, parkingBrake, dtcCodes (8% probability, codes SAE J2012 reales), ecoScore
- `FleetAssetLive` extendido con `canData?: CanSnapshot | null` y `deviceModel`
- `AssetDetailPanel` muestra secciones reales (Entradas, Telemetría CAN, Combustible, Distancia y uso, Diagnóstico DTCs si hay)
- **MOCK virtual · NO PERSISTIDO** · cuando llegue Sprint 2 con decisión schema (Opción A JSONB en Position vs B tabla CanReading), reemplazo es transparente (mismo shape)

### L4 · `S1-L4-libros-vehiculo` (2 nuevos + 2 actualizados · ~14KB)
**Tab Telemetría + matriz aplicabilidad:**
- `src/lib/object-modules.ts` reescrito con matriz validada
- Habilitada Conducción en SYSTEM_MODULES (porque scorecard ya vive desde L2)
- Tab nueva `Telemetría` (vehiculo-only) · KPIs CAN en vivo + DTCs + estado del equipo

### L4b · `S1-L4b-posicion-en-grupo` (5 nuevos + 1 actualizado · ~18KB)
**Scatter contextual:**
- Query `src/lib/queries/group-peers.ts` · `getGroupPeers(assetId, fromDate, toDate)` con métricas comparables (distanceKm, activeMin, tripCount, eventCount, eventsPer100km, safetyScore proxy)
- Componente client `PositionInGroupScatter.tsx` (Recharts) · activo color marca tamaño grande, peers grises, tooltip custom
- Sección server `PositionInGroupSection.tsx` orquesta 2 scatters (Distancia × Safety, Distancia × Eventos)
- Integrado en ActivityBookTab del vehículo · solo aparece si está en grupo con ≥ 2 peers

### L5 · `S1-L5-libro-conductores` (2 nuevos + 2 actualizados · ~10KB)
**Tab Conductores:**
- Aprovecha `AssetDriversPanel` y `AssetDriversHeatmap` que ya existían
- `DriversBookTab.tsx` wrapper liviano + matriz actualizada
- Lista de conductores que pasaron por el vehículo + heatmap semanal × 53 semanas

### L6 · `S1-L6-vista-ejecutiva-vehiculo` (2 nuevos + 2 actualizados · ~15KB)
**Tab Resumen como default del vehículo:**
- Hero state (estado en lenguaje natural · "En movimiento · 65 km/h")
- Telemetría destacada (4 KPIs CAN si tiene)
- Conductor actual card linkeada
- KPIs últimos 30 días
- Alarmas activas top 3
- Atajos a 5 tabs/pantallas
- Color solo en anomalías (Tufte)

### L7 · `S1-L7-cron-scaffold` (3 nuevos + 3 modificados · ~26KB)
**BoletinSnapshot model + Vercel Cron + endpoint:**
- Modelo `BoletinSnapshot` en schema · migration `20260504190000_add_boletin_snapshot`
- `vercel.json` · cron daily 06:00 UTC = 03:00 AR
- Endpoint `/api/cron/generate-boletines/route.ts` · auth via `CRON_SECRET` + lista accounts + persiste snapshot por cada uno
- Helper `src/lib/boletin/snapshot.ts` · read/write/upsert
- Page del boletín · check snapshot first, fallback on-demand a `loadBoletinData`
- **PLACEHOLDER · payload generado por el cron es minimal** · refactor de `loadBoletinData` queda para Sprint 2

### L8 · `S1-L8-feedback-widget` (4 nuevos + 2 modificados · ~23KB)
**Widget global de feedback:**
- Modelo `Feedback` en schema · migration `20260504194000_add_feedback`
- Endpoint POST `/api/feedback` · auth + validación + persist
- Widget UI flotante client (botón bottom-right + modal con form)
- Categorías: Bug · Idea · Otro
- Captura automática contexto (pageUrl, userAgent, viewport)
- Cerrar con ESC + click backdrop + botón cancelar
- **Mail aviso al PO · TODO Sprint 2** (cuando integremos Resend)

### L9 · `S1-L9-posthog-events` (5 nuevos + 2 modificados · ~18KB)
**Eventos custom + session replay opt-in:**
- EventMap expandido de 13 a 18 events (book_tab_changed, boletin_viewed, feedback_*, session_recording_*)
- Session replay activado vía `NEXT_PUBLIC_ENABLE_SESSION_REPLAY=1`
- Banner `SessionRecordingNotice` bottom-left · permite pausar (persist localStorage)
- FeedbackWidget instrumentado (open + submit + dismiss con `hadDraft`)
- README de funnels en `src/lib/analytics/README.md` con 4 funnels recomendados (F1 Onboarding, F2 Adopción Libro, F3 Feedback engagement, F4 Boletín pre-generado)

---

## 3 · Decisiones cerradas en Sprint 1

| Decisión | Resolución |
|---|---|
| Framework de tabs del Libro | Resumen / Telemetría / Conductores / [módulos del cubo: Actividad, Seguridad, Conducción, Mantenimiento, Combustible, Logística, Documentación, Sostenibilidad] |
| Default tab del vehículo | Resumen (vista ejecutiva cross-módulo) |
| Mock CAN sin schema | Módulo virtual hasta Sprint 2 (decisión Opción A vs B sigue pendiente) |
| Boletín scaffold | Infra completa, generación real Sprint 2 (refactor de loadBoletinData) |
| Feedback widget | Global, persiste en DB, mail aviso Sprint 2 |
| Session replay | Opt-in vía env var · banner persistente con opt-out |
| Multi-tenancy | Opción A híbrido (decisión cerrada en HANDOFF v2) · NO regenerar schema |
| MVP Scope | Opción C Enterprise (todos módulos obligatorios) · cerrada en v2 |
| Background jobs | Vercel Cron nativo · cerrada en v2 |

### Matriz de aplicabilidad módulo×tipo (validada)

| Tab | vehículo | conductor | grupo |
|---|---|---|---|
| Resumen 🆕 | ✓ | ✗ | ✗ |
| Telemetría 🆕 | ✓ | ✗ | ✗ |
| Conductores 🆕 | ✓ | ✗ | ✗ |
| Actividad | ✓ | ✓ | ✓ |
| Seguridad | ✓ | ✓ | ✓ |
| Conducción | ✓ | ✓ | ✓ |
| Mantenimiento | ✓ | ✗ | ✓ |
| Combustible | ✓ | ✗ | ✓ |
| Logística | ✓ | ✗ | ✓ |
| Documentación | ✓ | ✓ | ✗ |
| Sostenibilidad | ✓ | ✗ | ✓ |

Las 3 primeras (Resumen, Telemetría, Conductores) son **tabs intrínsecas** del vehículo · no son módulos del cubo · no aparecen en sidebar.

---

## 4 · Estado del schema y migrations

### Modelos nuevos en Sprint 1
```
+ BoletinSnapshot (S1-L7)
  - id, period (YYYY-MM), accountId?, payload Json, generatedAt, source
  - @@unique([period, accountId])

+ Feedback (S1-L8)
  - id, accountId?, userId?, category, message, pageUrl, userAgent, viewport?, status, createdAt, reviewedAt?, adminNotes?

+ enum FeedbackCategory · BUG | FEATURE | OTHER
+ enum FeedbackStatus · NEW | REVIEWED | CLOSED
```

### User · relación inversa agregada
```diff
+ feedbacks Feedback[]
```

### Migrations creadas
```
prisma/migrations/
  20260430233707_initial_postgres
  20260501000944_add_supabase_auth_id
  20260501123737_add_account_settings
+ 20260504190000_add_boletin_snapshot     ← S1-L7
+ 20260504194000_add_feedback              ← S1-L8
```

### Setup post-apply obligatorio (si no se hizo aún)
```bash
cd ~/Downloads/maxtracker-functional
npx prisma generate
npx prisma migrate deploy   # producción Supabase
rm -rf .next && npm run dev
```

### Env vars nuevas para Vercel
| Variable | Cuándo | Notas |
|---|---|---|
| `CRON_SECRET` | L7 · obligatorio | `openssl rand -hex 32` |
| `NEXT_PUBLIC_ENABLE_SESSION_REPLAY` | L9 · opcional | `1` para activar grabación · solo en builds de tester |

---

## 5 · Roadmap propuesto Sprint 2

### Lotes de máxima prioridad

**S2-L1 · refactor loadBoletinData** (~2 días)
- Mover lógica de `src/app/(product)/direccion/boletin/[period]/page.tsx` línea 309 (`async function loadBoletinData`) a `src/lib/queries/boletin-data.ts`
- Exportar tipos `BoletinData` y la función
- Modificar el endpoint cron `/api/cron/generate-boletines` para llamar a esta función real (reemplazar `buildPlaceholderPayload`)
- Validar que el snapshot generado pasa `isValidBoletinPayload` (ya construido en L7)
- Verificar que el page.tsx del boletín usa el snapshot cuando existe

**Resultado:** boletín sirve instantáneo desde caché · cron diario lo refresca · medible vía evento `boletin_viewed` con source="snapshot"

**S2-L2 · integración Resend (mail aviso feedback)** (~1 día)
- `npm install resend`
- Env var `RESEND_API_KEY`
- Helper `src/lib/email/send.ts` · wrapper sobre Resend
- Trigger en endpoint `/api/feedback`: enviar mail a `feedback@maxtracker.app` (o variable env) cuando entra feedback
- Email template simple en HTML con: category, user (si autenticado), pageUrl, userAgent, message
- Antispam · rate limit por user (max 3/hora)

**S2-L3 · Schema CAN real** (~1-2 días)
**Decisión pendiente:** Opción A vs B · sugiero Opción A (JSONB en Position) por velocidad de implementación
- Migration · agregar `canData Json?` a Position
- Mapper Flespi → Position con canData parseado
- Reemplazar mock virtual por consultas reales en `AssetDetailPanel` y `TelemetryBookTab`
- El mock-can sigue como fallback para vehículos sin canData histórico

**S2-L4 · Onboarding manual de 4 testers** (~1 día)
- Crear users en Supabase Auth manualmente (4 emails de confianza)
- Asignarlos a cuentas demo
- Verificar que ven el FeedbackWidget y SessionRecordingNotice
- Activar `NEXT_PUBLIC_ENABLE_SESSION_REPLAY=1` en Vercel
- Compartir con los testers el primer link del producto

### Lotes secundarios

**S2-L5 · curvas históricas CAN** · cuando Sprint 2 tenga schema real, reemplazar el snapshot del momento por curvas (RPM por hora del día, combustible decay diario, etc.) en TelemetryBookTab.

**S2-L6 · admin UI de Feedback** · pantalla `/admin/feedback` con tabla de feedbacks, status (NEW/REVIEWED/CLOSED), notas internas. Solo accesible para perfiles SUPER_ADMIN/MAXTRACKER_ADMIN.

**S2-L7 · scatter en Libros de conductor y grupo** · extender el patrón de `PositionInGroupSection` (hoy vehiculo-only) a las otras 2 dimensiones del cubo. Posición del conductor vs sus pares · posición del grupo vs otros grupos.

---

## 6 · Open decisions pendientes

### DPM-001 · ¿asset puede pertenecer a múltiples grupos?
**Estado:** sin resolver desde HANDOFF v1.
**Implicancia:** schema actual (Asset.groupId String?) es 1:N · si la decisión es N:M, requiere tabla pivot.
**Reco:** mantener 1:N hasta que un cliente real lo pida.

### Schema CAN · Opción A vs B
**Opción A:** `canData Json?` en Position
- Pro: zero refactor del UI · una query
- Contra: mediana flexibilidad · queries específicas más lentas
**Opción B:** tabla separada `CanReading`
- Pro: mejor para queries específicas (ej. "todas las temps > 100°C del mes")
- Contra: más complejo · 2 queries por position

**Reco:** Opción A para Sprint 2 (entrega rápido). Si performance lo requiere después, migrar a B con dual-write para evitar downtime.

### Auth real
**Diferida a Sprint 7** según HANDOFF v2. Por ahora `LoginPicker` demo + Supabase Auth para builds de prod.

---

## 7 · Tooling y archivos clave

### Working files
- **Sandbox:** `/home/claude/repo/maxtracker-functional/`
- **Sesiones previas:** transcripts en `/mnt/transcripts/`
- **Lotes generados:** `/home/claude/lotes/<lote>/` (con apply.sh + _payload/)
- **Outputs entregados:** `/mnt/user-data/outputs/<lote>.zip`

### Archivos clave para conocer
- `src/lib/object-modules.ts` · matriz aplicabilidad módulo×tipo (cualquier ajuste de tabs del Libro pasa por acá)
- `src/lib/mock-can/generate.ts` · generador determinístico CAN (reemplazar en Sprint 2)
- `src/lib/queries/group-peers.ts` · query del scatter contextual
- `src/lib/boletin/snapshot.ts` · helpers de cache del boletín
- `src/lib/analytics/posthog.ts` · wrapper + EventMap tipado
- `src/lib/analytics/README.md` · catálogo eventos + funnels recomendados
- `src/app/(product)/objeto/[tipo]/[id]/page.tsx` · switch de tabs del Libro
- `src/app/(product)/layout.tsx` · monta CmdK + FeedbackWidget + SessionRecordingNotice + PostHogProvider

### Validación rápida del estado
```bash
cd ~/Downloads/maxtracker-functional
git status                                        # debe estar clean post-deploy
npx tsc --noEmit | grep "error TS" | wc -l        # debe ser 0
ls prisma/migrations/                             # debe haber 5 migrations
grep "model " prisma/schema.prisma | wc -l        # debe haber ~25 modelos
```

---

## 8 · Lecciones aprendidas Sprint 1

### Lo que funcionó
- **Modo bulk** con lotes pequeños (~3-7 archivos cada uno) · 10 lotes en un solo "sprint" virtual sin friction
- **Idempotencia obligatoria** del apply.sh · permite re-aplicar sin miedo a romper
- **Test e2e en cada cierre** (clone fresh + cadena + idempotencia + typecheck) · cero regresiones acumuladas
- **Aprovechar componentes preexistentes** · L5 fue mucho más chico de lo previsto al descubrir que `AssetDriversPanel` ya estaba construido
- **Scaffolds antes de implementación completa** · L7 entregó toda la infra de cron sin requerir el refactor invasivo de loadBoletinData (queda para S2 con scope acotado)

### Lo que evitar
- **Tabs nuevas en el Libro como ModuleKey** · funcionó pero genera deuda · cuando crezca el modelo, refactor a `BookTabKey` con sources `module | intrinsic`
- **Curvas históricas mock** · tentación de generar curvas con generateCanSnapshot llamado en loop · mejor esperar al schema real
- **Mail aviso instantáneo** · evitamos integrar Resend a último momento · mejor lote dedicado en Sprint 2

### Patrón a mantener
- Cuando un lote requiere decisión grande del PO (ej. schema, MVP scope, opción A vs B), **proponer recomendación y esperar confirmación** · no decidir unilateralmente
- Cuando un componente existe pero está sin usar, **considerar wrapper liviano** antes de reescribir
- Cuando se agrega un Modelo Prisma nuevo, **siempre incluir migration SQL en el lote** + recordatorio en apply.sh del `npx prisma generate && migrate deploy`

---

## 9 · Para arrancar la próxima sesión

### Si querés seguir Sprint 2 (recomendado)
Próximo lote: **S2-L1 · refactor loadBoletinData**

Pasos sugeridos:
1. View `src/app/(product)/direccion/boletin/[period]/page.tsx` líneas 218-787
2. Identificar la firma exacta de `BoletinData` (línea 218) y `loadBoletinData` (línea 309)
3. Crear `src/lib/queries/boletin-data.ts` con `loadBoletinData` exportada
4. Modificar el page.tsx para importar de la nueva ubicación
5. Modificar el endpoint cron para llamar a la función real con un payload completo
6. Verificar que `isValidBoletinPayload` (en page.tsx línea ~770) pasa con el nuevo shape

### Si preferís cambiar de tema
- Curvas históricas mock CAN (entrega visual rápida · L4 quedó pidiendo)
- Día-view chronologic del Libro (split lateral timeline+mapa que quedó pendiente desde sesiones anteriores)
- Conducción real (Sprint 4 según HANDOFF v2 · pero podemos hacer un POC ahora)

### Cualquier camino · primera acción de la sesión
```
view /mnt/user-data/uploads/HANDOFF-v3.md       # leer este archivo
view /home/claude/repo/maxtracker-functional   # verificar estado del sandbox
```

---

**FIN HANDOFF v3 · cierre Sprint 1**
