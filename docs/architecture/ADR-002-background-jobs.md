# ADR-002 · Background jobs architecture

| Campo | Valor |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-05-06 |
| **Deciders** | Alejandro (Product Owner) |
| **Supersedes** | — |
| **Superseded by** | — |
| **AG-008 issue** | #3 (background job architecture absent) |

---

## 1 · Contexto y problema

Maxtracker requiere ejecutar trabajos **fuera del ciclo request/response** del usuario · operaciones costosas que no caben en un request HTTP, o que deben correr en horarios específicos sin intervención humana.

### 1.1 · Casos de uso identificados

#### A · Pre-generación de boletines (activo · 3 crons)

Calcular boletines editoriales agregados al cierre de cada período, para que la lectura sea instantánea desde el cliente:

| Cron | Frecuencia | Volumen estimado @ 1M assets |
|---|---|---|
| `generate-boletines` | Diario · 06:00 UTC | 1 boletín/cuenta operativo |
| `generate-driver-boletines` | Diario · 06:15 UTC | ~100K conductores activos |
| `generate-fleet-boletines` | Diario · 06:30 UTC | ~1K grupos + 100 cuentas ejecutivas |

#### B · Email transaccional (futuro · post-A1)

Envío automático de:

- **Boletín mensual** al conductor al cierre del mes (si tiene email cargado)
- **Alarma crítica** al supervisor al disparo
- **Resumen ejecutivo** al CA semanalmente
- **Notificación de licencia próxima a vencer** 30 días antes

Stack ya disponible · Resend (incluye retry interno, bounce handling).

#### C · Webhooks salientes (futuro · post-MVP)

Notificar a sistemas externos del cliente:

- Eventos de geocerca (entrada/salida)
- Alarmas críticas en tiempo real
- Cambios de estado de assets

Requisitos · garantía de entrega, retry con backoff exponencial, dead-letter para fallos persistentes.

#### D · Cleanup periódico (futuro)

Mantenimiento de la base de datos:

- Borrar `BoletinSnapshot` de cuentas que cancelaron > 90 días
- Anonimizar `Event` de conductores con baja > 1 año (LGPD/LFPDPPP)
- Comprimir hypertables de TimescaleDB (Trip, Event)
- Archivar `Alarm` resueltas > 1 año

#### E · Retry de fallos en jobs principales (futuro)

Si la generación del boletín de un grupo individual falla en el cron diario, reintentarlo automáticamente al rato (sin esperar al próximo día completo).

#### F · Pipeline de ingestión TCP (separado · ADR-003)

La ingestión de telemetría desde dispositivos Teltonika es un caso de uso conceptualmente diferente · conexiones TCP persistentes, throughput de 11.500 eventos/seg, requisitos de latencia. **Se trata en ADR-003 separado.**

### 1.2 · Estado actual de la implementación

```
src/app/api/cron/
  ├── generate-boletines/         ✅ activo · cuenta operativa (S1)
  ├── generate-driver-boletines/  ⚠️ código existe · NO registrado en vercel.json
  └── generate-fleet-boletines/   ⚠️ código existe · NO registrado en vercel.json
```

`vercel.json` actual:

```json
{
  "crons": [
    { "path": "/api/cron/generate-boletines", "schedule": "0 6 * * *" }
  ]
}
```

**Problema inmediato:** los 2 crons nuevos del Sistema Editorial fueron desplegados pero **nunca se ejecutan** porque no están en `vercel.json`. El sistema se sostiene por el fallback on-demand, pero los snapshots no se pre-calculan.

### 1.3 · Limitaciones del enfoque actual

El uso exclusivo de Vercel Cron presenta limitaciones cuando el sistema crezca:

| Limitación | Impacto cuando aparece |
|---|---|
| **Timeout máximo** · 5min Hobby, 60s default Pro, 300s con `maxDuration` | Cron de fleet-boletines con 1000 grupos puede no terminar |
| **Sin retry automático** | Si un cron falla, hay que esperar al siguiente día |
| **Sin queue** | Burst de 1000 emails al cierre de mes puede sobrecargar SMTP |
| **Sin observability nativa** | No hay UI para ver "jobs corridos / fallidos / en progreso" |
| **Sin event-driven** | Solo time-based · no se puede disparar un job desde un webhook |
| **Sin workflows multi-paso** | "Generar boletín → Esperar → Enviar email" requiere lógica ad-hoc |
| **Cold start** | Vercel puede tener cold start de 1-3 seg en cada cron call |

Hoy, ninguna de estas limitaciones está bloqueando el producto. Pero todas aparecen progresivamente con la escala.

---

## 2 · Drivers de la decisión

| Driver | Peso | Por qué |
|---|---|---|
| **Confiabilidad** | 🔴 Alto | Jobs perdidos = boletines no generados, emails no enviados, clientes sin notificar |
| **Costo operativo** | 🟡 Medio | Startup en MVP · no inflar la factura para problemas que aún no tenemos |
| **Simplicidad** | 🔴 Alto | Una sola persona debe poder mantener el stack |
| **Observability** | 🟡 Medio | Cuando algo falla, hay que saber qué, cuándo y por qué |
| **Path to scale** | 🟡 Medio | La arquitectura debe poder crecer sin re-escritura completa |
| **Ya invertido (Vercel)** | 🟡 Medio | El stack ya está en Vercel · cualquier cambio tiene costo de aprendizaje |
| **Evitar vendor lock-in** | 🟢 Bajo | Ya hay lock-in pragmático con Vercel · sumar 1 más es bajo costo si vale |

---

## 3 · Opciones consideradas

### 3.1 · Opción A · Solo Vercel Cron (status quo expandido)

Continuar con Vercel Cron como única solución · agregar los 2 crons faltantes a `vercel.json` y construir todo lo necesario sobre esa base.

**Pros:**
- ✅ Zero infra adicional
- ✅ Ya está integrado · sin curva de aprendizaje
- ✅ Costo cero (incluido en Pro)
- ✅ Funciona perfectamente para el volumen actual

**Contras:**
- ❌ Sin queue · jobs grandes pueden timeoutear
- ❌ Sin retry automático · falla = se pierde hasta el próximo día
- ❌ Sin observability · debug por logs solamente
- ❌ Sin event-driven · solo time-based
- ❌ Workflows multi-paso requieren código custom

**Cuándo deja de alcanzar:**

- Cron supera los 5 min de runtime (depende del plan)
- Necesitamos retry inteligente (backoff, dead-letter)
- Aparecen casos event-driven (webhook IN → procesar)
- Volumen de emails > 1000/día

### 3.2 · Opción B · Vercel Cron + Queue dedicada (BullMQ + Redis Upstash)

Vercel Cron dispara jobs de queue · worker procesa con retry, backoff y concurrencia configurables.

```
Vercel Cron ─┐
             ├──► Upstash Redis (BullMQ) ──► Worker (Vercel function o Fly machine)
Webhook IN ──┘
```

**Pros:**
- ✅ Retry, backoff, dead-letter built-in
- ✅ Concurrencia controlada
- ✅ Soporta event-driven (no solo cron)
- ✅ Open source · sin lock-in

**Contras:**
- ❌ Requiere Redis (Upstash · pay-per-request o serverless)
- ❌ Worker · si corre en Vercel function, mismo timeout · si corre en Fly, infra adicional
- ❌ Operación más compleja · monitorear Redis, queues, dead-letter
- ❌ Curva de aprendizaje BullMQ para el equipo

**Costo estimado:** Upstash gratis hasta 10K requests/día · ~$10-30/mes a escala media.

### 3.3 · Opción C · Inngest (managed workflow engine)

Inngest es un servicio managed para workflows event-driven y scheduled jobs, con SDK para Next.js.

```typescript
// Job definition
export const generateBoletines = inngest.createFunction(
  { id: "generate-fleet-boletines" },
  { cron: "30 6 * * *" },
  async ({ event, step }) => {
    const groups = await step.run("list-groups", () => listActiveGroups());
    for (const g of groups) {
      await step.run(`gen-${g.id}`, () => generateBoletinForGroup(g));
    }
  },
);
```

**Pros:**
- ✅ Workflows multi-paso con durability (cada `step.run` es retry-able)
- ✅ Observability built-in (UI con history de runs, filas, errores)
- ✅ Event-driven nativo · `inngest.send({ name: "user.boletin.requested" })`
- ✅ Crons + queues + workflows en una sola abstracción
- ✅ Free tier generoso (50K runs/mes)
- ✅ Integración Next.js nativa con un endpoint
- ✅ Onboarding rápido · ~1 día

**Contras:**
- ❌ Vendor managed · lock-in moderado
- ❌ Costo a escala (~$20-100/mes a volúmenes medios)
- ❌ SDK custom · no es "solo TypeScript estándar"
- ❌ Privacidad de datos · jobs corren en infra Inngest (procesan IDs y metadatos)

### 3.4 · Opción D · Trigger.dev (alternativa managed)

Similar a Inngest · workflow engine managed con SDK.

**Pros y contras similares a C.** Diferencias clave:

- Trigger.dev tiene mejor abstracción de workflows largos (horas/días)
- Inngest tiene mejor integración con event-driven
- Trigger.dev tiene **runtime self-hostable** · escape de lock-in si hace falta
- Costo similar · ambos free tier ~50K runs/mes

### 3.5 · Opción E · Worker dedicado en Fly.io (long-running process)

Fly.io machine con un proceso Node.js que mantiene queue interna y corre los jobs.

```
Fly machine (always-on)
  └── BullMQ + Redis (Fly Redis) o pg-boss
        ├── Cron scheduler
        ├── Email sender
        ├── Webhook sender
        └── (futuro) TCP ingestion → ADR-003
```

**Pros:**
- ✅ Control total
- ✅ Mismo proceso puede compartir con TCP listener (ADR-003)
- ✅ Sin timeouts ni cold starts
- ✅ Infra ya planificada (Fly.io en stack)

**Contras:**
- ❌ Más infra que mantener (always-on machine)
- ❌ Costo fijo (~$5-30/mes mínimo)
- ❌ Complejidad operativa (deploy, healthchecks, restart, logs)
- ❌ Overkill para los casos de uso actuales

---

## 4 · Decisión

**Adoptar arquitectura híbrida y evolutiva en 3 fases:**

### Fase 0 (inmediata, status quo) · Vercel Cron

Es lo que tenemos. Cubre el 100% de los casos de uso actuales (boletines pre-generados). Solo falta **registrar los 2 crons faltantes en `vercel.json`** (lote A2-1 · 5 min de trabajo).

### Fase 1 (~1 mes después de salir a producción) · Inngest

Cuando empiecen a aparecer casos de uso que Vercel Cron no cubre bien:

- Email transaccional (boletín mensual al conductor)
- Webhooks salientes
- Workflows multi-paso (generar → enviar → confirmar)

**Adoptar Inngest** (Opción C). Razones:

- Onboarding más rápido que BullMQ + Redis (días vs semanas)
- Free tier cubre MVP (50K runs/mes vs ~5K runs/mes de boletines + emails actuales)
- Reduce el código de retry/backoff que de otra manera hay que escribir
- Migración desde Vercel Cron es gradual · cada cron migra cuando le toca

### Fase 2 (cuando exista pipeline TCP · ADR-003) · Worker Fly.io para casos específicos

El worker que ADR-003 va a definir para TCP **NO se usa para reemplazar Inngest**. Cada uno tiene su rol:

- **Inngest** · jobs basados en eventos lógicos del producto (boletines, emails, webhooks)
- **Worker Fly.io** · solo TCP ingestion (necesita conexión persistente, latencia baja)

### 4.1 · Triggers concretos para pasar de Fase 0 a Fase 1

Adoptar Inngest cuando aparezca **cualquiera** de estos:

- ✅ Volumen de emails transaccionales > 1000/día
- ✅ Necesitamos webhooks salientes con retry/backoff
- ✅ Algún cron supera 5 min de runtime consistentemente
- ✅ Workflows multi-paso ad-hoc en > 3 lugares del código
- ✅ Caso de uso event-driven (webhook IN → procesar async)

Mientras ninguno aparezca · **no migrar**. Vercel Cron es suficiente.

### 4.2 · Lo que se hace AHORA (Sprint A2-1)

Dos cambios mínimos:

1. **Agregar los 2 crons faltantes a `vercel.json`** (cron-driver-boletines + cron-fleet-boletines)
2. **Documentar el patrón de "falla suave por entidad"** en `docs/architecture/cron-patterns.md` · ya está implementado pero no documentado

### 4.3 · Lo que NO se decide ahora

- **No** se compromete a Inngest sin necesidad concreta
- **No** se introduce Redis ni infra adicional
- **No** se migran los crons existentes que funcionan

Cuando llegue el trigger, el ADR-002 se actualiza con la decisión de migración (puede ser una nueva versión del ADR o un ADR-002.1 separado).

---

## 5 · Consecuencias

### 5.1 · Positivas

- 🟢 **Cero infra adicional ahora** · el costo se paga cuando trae beneficio
- 🟢 **Camino claro de evolución** · Inngest documentado como "next step"
- 🟢 **Migración gradual** · cada cron migra cuando le toca (no big-bang)
- 🟢 **Reversible** · Inngest se puede reemplazar por BullMQ o Trigger.dev si cambia algo
- 🟢 **Aprovecha lo invertido** · Vercel Cron sigue siendo first-class

### 5.2 · Negativas

- 🔴 **Deuda técnica latente** · cuando aparezcan los triggers, hay que migrar bajo presión
- 🔴 **Sin observability hoy** · debug de crons solo por logs de Vercel
- 🔴 **Sin retry automático** · si un cron falla por un transient error, hay que esperar al próximo
- 🔴 **Casos críticos vulnerables** · alarma crítica → email puede perderse si Resend tiene un blip momentáneo

### 5.3 · Neutras

- 🟡 **Decisión postpuesta** · es OK · evita over-engineering
- 🟡 **Vercel Cron tiene límites del plan Pro** · cap de jobs simultaneos, retención de logs
- 🟡 **Inngest es vendor managed** · trade-off conocido

---

## 6 · Implementation roadmap

### Sprint A2-1 · Registrar crons faltantes (inmediato · 30 min)

- [ ] Editar `vercel.json` · agregar entries para `generate-driver-boletines` y `generate-fleet-boletines`
- [ ] Ajustar `maxDuration` de los 2 nuevos a 60 segundos
- [ ] Push · primer disparo automático en próximo cron schedule

```json
{
  "functions": {
    "src/app/api/cron/generate-boletines/route.ts": { "maxDuration": 60 },
    "src/app/api/cron/generate-driver-boletines/route.ts": { "maxDuration": 60 },
    "src/app/api/cron/generate-fleet-boletines/route.ts": { "maxDuration": 60 }
  },
  "crons": [
    { "path": "/api/cron/generate-boletines",        "schedule": "0 6 * * *" },
    { "path": "/api/cron/generate-driver-boletines", "schedule": "15 6 * * *" },
    { "path": "/api/cron/generate-fleet-boletines",  "schedule": "30 6 * * *" }
  ]
}
```

### Sprint A2-2 · Documentar patrones (inmediato · 1 hora)

- [ ] Crear `docs/architecture/cron-patterns.md` con:
  - Falla suave por entidad
  - Auth con CRON_SECRET
  - Lógica de regeneración (mes en curso · día 1 anterior · 1 enero año anterior)
  - Helpers `getOrGenerate*` con fallback on-demand

### Sprint A2-3 · Observability básica (post-MVP · 1 día)

- [ ] Tabla `CronRun` que registra cada ejecución (timestamp, duration, status, errors)
- [ ] Vista `/admin/crons` con historial de runs
- [ ] Alerta a Slack/email si un cron falla 3 veces seguidas

### Sprint A2-4 · Migración a Inngest (cuando aplique trigger · 2-3 días)

- [ ] Setup Inngest cuenta + SDK
- [ ] Crear endpoint `/api/inngest/route.ts`
- [ ] Migrar primer cron como prueba (`generate-fleet-boletines` · el más complejo)
- [ ] Validar observability + retry funcionando
- [ ] Migrar los 2 crons restantes
- [ ] Sumar primeras funciones event-driven (email, webhooks)

---

## 7 · Compliance y observabilidad

### 7.1 · Auth de crons (ya implementado)

Cada endpoint de cron valida `Authorization: Bearer $CRON_SECRET`. Vercel inyecta este header automáticamente en cron calls.

```typescript
const expected = `Bearer ${process.env.CRON_SECRET}`;
if (authHeader !== expected) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

### 7.2 · Patrón de falla suave (ya implementado)

Cada cron itera entidades · si una falla, se loggea y se sigue con el resto. Nunca aborta el cron entero.

```typescript
for (const entity of activeEntities) {
  try {
    await processEntity(entity);
    successCount++;
  } catch (e) {
    errorLog.push({ entityId: entity.id, error: e.message });
    errorCount++;
  }
}
return NextResponse.json({ ok: true, successCount, errorCount, errorLog });
```

### 7.3 · Verificación periódica

Cada 30 días · revisar:

```bash
# Logs de Vercel · qué crons corrieron en los últimos 7 días
vercel logs --since 7d --filter cron

# ¿Algún cron falló > 3 veces consecutivas?
# (post Sprint A2-3 · automatizado con tabla CronRun)
```

### 7.4 · Métricas a trackear

Una vez Sprint A2-3 esté listo · dashboard con:

| Métrica | Threshold |
|---|---|
| Crons ejecutados/día | Esperado: 3/día (los 3 schedules) |
| % de runs exitosos | > 99% |
| P95 duration | < 60s (max permitido) |
| Errores por cron | < 1% del total de entidades procesadas |
| Alarma · 3 fallos consecutivos | Notificar a Slack/email |

---

## 8 · Anti-patterns que evitar

### 8.1 · Cron que computa todo "in process"

```typescript
// ❌ MAL · si falla en mitad del proceso, se pierde todo
async function generate() {
  const groups = await listGroups();
  for (const g of groups) {
    const data = await compute(g);
    await save(data);
  }
}
```

```typescript
// ✅ BIEN · cada entidad es atómica con falla suave
async function generate() {
  const groups = await listGroups();
  const results = [];
  for (const g of groups) {
    try {
      const data = await compute(g);
      await save(data);
      results.push({ id: g.id, ok: true });
    } catch (e) {
      results.push({ id: g.id, ok: false, error: e.message });
    }
  }
  return results;
}
```

### 8.2 · Cron sin auth

```typescript
// ❌ MAL · cualquiera puede dispararlo
export async function GET() {
  await runExpensiveJob();
  return NextResponse.json({ ok: true });
}
```

```typescript
// ✅ BIEN · auth con CRON_SECRET
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await runExpensiveJob();
  return NextResponse.json({ ok: true });
}
```

### 8.3 · Cron sin maxDuration explícito

```typescript
// ❌ MAL · default 10s en Vercel · timeout silencioso
export async function GET() { ... }
```

```typescript
// ✅ BIEN · explícito en vercel.json
{
  "functions": {
    "src/app/api/cron/foo/route.ts": { "maxDuration": 60 }
  }
}
```

### 8.4 · Cron que asume horario sin TZ

```typescript
// ❌ MAL · ¿"6 AM" en qué TZ?
const today = new Date();
if (today.getHours() === 6) { ... }
```

```typescript
// ✅ BIEN · siempre UTC en lógica · convertir a local solo para display
const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000); // ART
const day = todayLocal.getUTCDate();
```

---

## 9 · Referencias

- Vercel Cron Jobs · https://vercel.com/docs/cron-jobs
- Inngest · https://www.inngest.com
- Trigger.dev · https://trigger.dev
- BullMQ · https://docs.bullmq.io
- pg-boss · https://github.com/timgit/pg-boss
- Upstash Redis · https://upstash.com/docs/redis
- AG-008 audit · sección "Background job architecture absent"
- Maxtracker · ADR-003 (Pipeline TCP de ingestión) · separado

---

## 10 · Apéndice · árbol de decisión rápido

```
¿Necesito ejecutar algo en background?
│
├── ¿Es time-based recurrente y < 60s?
│   └── ✅ Vercel Cron
│
├── ¿Es event-driven (disparado por algo del producto)?
│   ├── ¿Volumen bajo y crítico no?
│   │   └── ✅ Vercel function async + Resend retry interno
│   └── ¿Volumen alto o garantía requerida?
│       └── ⏰ Inngest (Sprint A2-4)
│
├── ¿Es workflow multi-paso?
│   ├── ¿2 pasos y simple?
│   │   └── ✅ Vercel Cron secuencial
│   └── ¿3+ pasos con retry independiente?
│       └── ⏰ Inngest (Sprint A2-4)
│
├── ¿Necesita conexión TCP persistente?
│   └── ⏰ Worker Fly.io (ADR-003)
│
└── ¿Es procesamiento masivo (>10K items)?
    └── ⏰ Inngest con concurrencia (Sprint A2-4)
```

⏰ = Postergado hasta que aplique el trigger · ver §4.1

---

**Decisión:** ✅ Aceptado · ejecutable como Sprint A2-1 (5 min) · resto a futuro según triggers.
