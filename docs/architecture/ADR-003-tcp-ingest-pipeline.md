# ADR-003 · Pipeline TCP de ingestión + almacenamiento de telemetría

| Campo | Valor |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-05-06 |
| **Deciders** | Alejandro (Product Owner) |
| **Supersedes** | — |
| **Superseded by** | — |
| **AG-008 issue** | #1 (pipeline TCP de ingestión absent) |
| **Relacionados** | ADR-001 (multi-tenancy) · ADR-002 (background jobs) |

---

## 1 · Contexto y problema

Maxtracker es una plataforma de telemática IoT que apunta a **1.000.000 de assets monitoreados** con un throughput target de **11.500 eventos/seg** sostenidos. La forma en que esos eventos entran al sistema y cómo se almacenan determina la escalabilidad, el costo operativo y la latencia de toda la plataforma.

Este ADR cubre **dos decisiones acopladas**:

1. **Pipeline de ingestión** · cómo llegan los eventos desde los dispositivos Teltonika al sistema
2. **Almacenamiento de telemetría a escala** · cómo se persisten cuando hay 11.500 inserts/seg

Ambas se tratan juntas porque la elección de uno restringe al otro.

### 1.1 · Estado actual

#### Ingestión

```
Dispositivos Teltonika ─TCP─► Flespi (cloud) ─HTTP POST batch─► Vercel function
                                                                       │
                                                                       ▼
                                                                  Postgres (writes
                                                                  individuales · sin
                                                                  hypertables)
```

- **Endpoint** · `POST /api/ingest/flespi/route.ts` (Vercel function)
- **Auth** · `X-Flespi-Token` o `Authorization: Bearer <token>`
- **Payload** · array de mensajes JSON
- **maxDuration** · 30 segundos
- **Procesa por mensaje** · mapping → match IMEI → persist Position + LivePosition + update Device

#### Almacenamiento

- `Position` · tabla normal Postgres · ~150 bytes/fila
- `Event` · tabla normal Postgres · ~250 bytes/fila
- `Trip` · tabla normal Postgres
- **Sin TimescaleDB hypertables** (mencionado en comentarios pero nunca creado)
- **Sin compression policy**
- **Sin retention policy**
- **Sin partitioning**

### 1.2 · Volumen target

| Métrica | Valor target | Volumen acumulativo |
|---|---|---|
| Assets monitoreados | 1.000.000 | — |
| Frecuencia ping promedio | 1 cada 30 seg | — |
| Eventos por seg sostenidos | 11.500 | — |
| Posiciones nuevas/día | 2.880.000.000 | — |
| Trips/día (promedio 4/asset/día) | 4.000.000 | — |
| Events de comportamiento/día | ~30.000.000 | — |
| **Storage Position/año** | — | **~432 TB** ⚠️ |
| **Storage Event/año** | — | **~10.95 TB** |

A volumen target, una sola tabla Postgres normal de Position **no funciona**. Necesita partitioning + compression + retention por capas, lo cual TimescaleDB resuelve nativamente.

### 1.3 · Limitaciones del enfoque actual

#### Del lado de ingestión (Flespi + Vercel)

| Limitación | Impacto cuando aparece |
|---|---|
| **Costo Flespi** · $0.06-0.15/dispositivo/mes según plan | $60K-150K/mes a 1M assets |
| **Vercel function maxDuration** · 30s (actual) hasta 5min (Pro) | Batch grande puede timeoutear silenciosamente |
| **Sin idempotencia** · si Flespi reenvía batch (timeout), se duplica | Datos inflados, scores erróneos |
| **Cold start** · Vercel function 1-3 seg | Latencia P95 elevada |
| **Sin connection pool persistente** · cada request abre conexión Prisma | Costo CPU + latencia |
| **Sin backpressure** · si Postgres está lento, Flespi sigue mandando | Cascada de timeouts |
| **Vendor lock-in Flespi** · sin contingencia si caen | SPOF crítico |
| **Sin CAN bus completo** · Flespi mapea solo subset de codec 8/8E | Datos perdidos para ciertos casos |

#### Del lado de almacenamiento (Postgres normal)

| Limitación | Impacto cuando aparece |
|---|---|
| **Sin partitioning** · query "última semana" hace scan total | Queries > 30 seg cuando hay > 100M filas |
| **Sin compression** · 432 TB/año en disco | Costo storage prohibitivo |
| **Sin retention** · datos viejos crecen sin límite | Backup/restore inviable |
| **Bloat de índices** · constant inserts + occasional updates | Vacuum diario obligatorio |
| **Sin agregaciones continuas** · los KPIs se recalculan en cada query | Dashboard lento |

Hoy el sistema tiene < 1000 dispositivos en testing · estas limitaciones no aparecen. Pero la arquitectura no soporta el target del producto.

---

## 2 · Drivers de la decisión

| Driver | Peso | Por qué |
|---|---|---|
| **Escalabilidad a 1M assets** | 🔴 Alto | El target del producto · no negociable |
| **Costo a escala** | 🔴 Alto | A 100K assets, Flespi cuesta $6K-15K/mes |
| **Latencia E2E** · device → DB persist | 🟡 Medio | Hoy ≈ 800ms · target < 2 seg P95 |
| **Disponibilidad** · evitar SPOF | 🟡 Medio | Ingestión interrumpida = ventas perdidas |
| **Data ownership** · poder migrar de proveedor | 🟡 Medio | Lock-in con Flespi limita evolución |
| **Codec coverage** · soportar todos los Teltonika | 🟡 Medio | Flespi cubre 80% · faltan codecs especiales |
| **Time-to-market** | 🔴 Alto | No bloquear el lanzamiento por refactor de ingesta |
| **Operación simple** | 🟡 Medio | Una persona debe poder mantenerlo |
| **Compliance** · datos en LATAM (LGPD) | 🟡 Medio | Ideal data plane en región LATAM |

---

## 3 · Opciones consideradas

### 3.1 · Opción A · Mantener Flespi + Vercel (status quo)

Continuar con el setup actual. Optimizar lo que se pueda.

**Optimizaciones posibles:**

- Batches más grandes en Vercel function (reducir overhead)
- `createMany` para Position (ya implementado)
- Connection pool reutilizable (PgBouncer)
- Idempotency key por mensaje

**Pros:**
- ✅ Funciona hoy · sin riesgo de regresión
- ✅ Cero infra adicional para mantener
- ✅ Flespi maneja el TCP listening (su problema)
- ✅ Onboarding de devices nuevos vía Flespi UI

**Contras:**
- ❌ **No escala a 1M assets** (límite hard de Flespi + Vercel)
- ❌ Costo lineal con # devices · prohibitivo a escala
- ❌ Lock-in total con Flespi
- ❌ Latencia y cold start en Vercel functions
- ❌ Sin control sobre codec coverage

**Ceiling estimado:** ~10K-50K devices según plan Flespi · luego empieza a doler.

### 3.2 · Opción B · TCP listener en Vercel Edge Runtime

Vercel Edge Functions tienen runtime distinto · ¿soporta sockets TCP persistentes?

**Verificación:** ❌ NO. Vercel Edge Runtime no soporta `net.createServer()` ni sockets crudos. Es Web Standards-based · solo HTTP/WebSocket.

**Verdict:** Opción descartada técnicamente.

### 3.3 · Opción C · Worker TCP dedicado en Fly.io

Fly.io machine corriendo Node.js con `net.createServer()` · listening directo en puerto TCP. Recibe los mensajes Teltonika raw, parsea, encola y persiste.

```
Dispositivos Teltonika ─TCP raw (port 6000)─► Fly.io machine
                                                    │
                                                    ▼
                                              Parser Codec 8/8E
                                                    │
                                                    ▼
                                              Queue (in-memory + Redis backup)
                                                    │
                                                    ▼
                                              Postgres + TimescaleDB
                                              (batch inserts cada 1s)
```

**Pros:**
- ✅ Connection persistente · sin overhead por mensaje
- ✅ Control total · cualquier codec, cualquier optimización
- ✅ Costo muy bajo a escala (~$30-100/mes para 1M assets)
- ✅ Sin lock-in · es Node.js standard
- ✅ Latencia baja · no hay middleman
- ✅ Multi-region en Fly · GRU + EZE para LATAM
- ✅ Compatible con stack actual (Fly.io ya está en planning)

**Contras:**
- ❌ Worker always-on (costo fijo, ~$5-30/mes mínimo)
- ❌ Onboarding de devices · cada cliente reconfigura sus equipos al endpoint nuevo
- ❌ Operación más compleja · monitorear, healthcheck, restart
- ❌ Implementar parser Codec Teltonika es trabajo (~3-5 días)
- ❌ Backpressure y retry · responsabilidad del worker

**Costo estimado:** $30-100/mes a 1M assets (vs $60K-150K Flespi).

### 3.4 · Opción D · Worker TCP en AWS (EC2 + Lambda híbrido)

EC2 con NLB para TCP · Lambdas para procesamiento batch.

**Pros:**
- ✅ Disponibilidad y SLA enterprise
- ✅ Auto-scaling nativo
- ✅ Multi-AZ y multi-region

**Contras:**
- ❌ Mucho más complejo de operar
- ❌ Vendor diferente (sumar AWS al stack Vercel/Supabase/Fly)
- ❌ Costo mayor que Fly
- ❌ Lock-in AWS

### 3.5 · Opción E · Híbrido · Flespi para devices legados + TCP propio para devices nuevos

Mantener Flespi para los dispositivos ya conectados (clientes existentes) · TCP propio para nuevos clientes.

**Pros:**
- ✅ Cero migración forzada para clientes actuales
- ✅ Reduce costo Flespi gradualmente
- ✅ Permite testing en producción del TCP propio sin todo-o-nada

**Contras:**
- ❌ Dos pipelines paralelos · complejidad operativa
- ❌ Dos formatos de error, dos lugares para debug
- ❌ Lock-in Flespi sigue para una porción de la flota

---

## 4 · Decisión

**Adoptar Opción E (Híbrido) en 3 fases:**

### Fase 1 · Optimizar Flespi + crear TimescaleDB foundations (Sprint A3-1, A3-2)

**Lo crítico ahora** · habilitar TimescaleDB hypertables y retention, **independientemente del pipeline de ingestión**.

Razón · si los devices crecen a 10K mañana con Flespi pero las tablas son normales, la DB colapsa. **TimescaleDB es prerequisito, no consecuencia, del scaling.**

**Acciones:**

1. Convertir `Position` a hypertable (chunk_time_interval = 1 día)
2. Convertir `Event` a hypertable (chunk_time_interval = 7 días)
3. Habilitar compression policy (después de 7 días → 95% compression típico)
4. Habilitar retention policy (12 meses online, archivar el resto)
5. Continuous aggregates para KPIs comunes (km/día por asset, etc.)

### Fase 2 · Worker TCP propio en Fly.io para nuevos onboardings (Sprint A3-3 a A3-7)

**Cuando se justifique por costo o features**, implementar el worker TCP en Fly.io. Devices nuevos apuntan al worker propio · devices legacy siguen via Flespi.

**Triggers para arrancar Fase 2:**

- ✅ Costo Flespi > $1.000/mes (≈ 5-10K devices)
- ✅ Necesidad de codec específico no soportado por Flespi
- ✅ Latencia P95 > 2 seg sostenidamente
- ✅ Cliente enterprise pide SLA con vendor único

### Fase 3 · Migración gradual de devices legacy (Sprint A3-8+)

Si el costo Flespi sigue creciendo · migrar devices del Flespi al worker propio en lotes (con coordinación con cliente · cambio de endpoint en su flota).

### 4.1 · Decisión sobre TimescaleDB · ahora, no después

**TimescaleDB es prerequisito**, no opcional. Independientemente de qué pipeline de ingestión usemos:

- Position e Event como hypertables
- Compression después de 7 días
- Retention 12 meses (configurable por cuenta · enterprise puede pagar más)

Esto se hace YA · primer sprint del ADR-003.

### 4.2 · Decisión sobre worker propio · cuando aplique trigger

NO se construye preventivamente. Se construye cuando aparezca la necesidad concreta. Mientras Flespi sirva al volumen actual, no se invierte en infra adicional.

### 4.3 · Patrón de codec a soportar primero (cuando Fase 2)

Prioridad de codecs Teltonika para el worker propio:

1. **Codec 8** · firma digital base · 80% del fleet target
2. **Codec 8E** · extended elements · CAN bus completo
3. **Codec 12** · GPRS commands · usado en SOS/panic
4. **Codec 14** · usado para crashes
5. **Codec 16** · GPRS responses

Codec 8 + 8E cubre ~95% de los casos de uso · suficiente para Fase 2.

---

## 5 · Consecuencias

### 5.1 · Positivas

- 🟢 **Path claro de evolución** · sin big-bang
- 🟢 **TimescaleDB ataca el cuello de botella inmediato** · sin esperar al pipeline
- 🟢 **Costo controlado** · Flespi solo lo necesario · no escala innecesario
- 🟢 **Reversible** · siempre se puede volver a Flespi-only si el worker falla
- 🟢 **Compatible con clientes actuales** · no obliga a re-onboard

### 5.2 · Negativas

- 🔴 **Período híbrido complejo** · 2 pipelines simultáneos en Fase 2-3
- 🔴 **Costo Flespi sigue mientras no migremos** · puede crecer si no llegamos a Fase 2 a tiempo
- 🔴 **Worker propio es trabajo significativo** · 5-10 días dev + ops continuo
- 🔴 **TimescaleDB en Supabase** · verificar que la extensión está disponible (Supabase la soporta, pero hay limitaciones)
- 🔴 **Migración Position → hypertable es destructiva** · requiere downtime planificado o blue-green

### 5.3 · Neutras

- 🟡 **Lock-in TimescaleDB** · es Postgres extension · si pasa a otro Postgres compatible, OK. Si pasa a otra DB, hay refactor.
- 🟡 **Codec parser propio** · hay libraries open source (`teltonika-parser`, etc.) · no hace falta partir de cero
- 🟡 **Fly.io ya estaba en planning** · sumar este uso no agrega vendor

---

## 6 · Implementation roadmap

### Sprint A3-1 · TimescaleDB · Position como hypertable (3-4 días)

- [ ] Verificar TimescaleDB habilitado en Supabase Postgres
- [ ] Crear migración SQL · `SELECT create_hypertable('Position', 'recordedAt', chunk_time_interval => INTERVAL '1 day')`
- [ ] Migrar datos existentes (si hay · con `COPY` para evitar bloqueo)
- [ ] Compression policy · `SELECT add_compression_policy('Position', INTERVAL '7 days')`
- [ ] Retention policy · `SELECT add_retention_policy('Position', INTERVAL '12 months')`
- [ ] Validar performance · query "última semana de un asset" debe ser < 100ms

### Sprint A3-2 · TimescaleDB · Event hypertable + continuous aggregates (2-3 días)

- [ ] `Event` como hypertable (chunk_time_interval = 7 días)
- [ ] Compression policy
- [ ] Continuous aggregate · `event_count_per_asset_per_day`
- [ ] Continuous aggregate · `position_summary_per_asset_per_day` (km, durations)
- [ ] Refrescar policy · cada 1 hora durante el día actual
- [ ] Documentar el schema en `docs/architecture/timescale-schema.md`

### Sprint A3-3 · Decisión Fly.io · setup base del worker (1-2 días)

**Solo si se aplicó algún trigger del §4.**

- [ ] Crear Fly.io app · `maxtracker-ingest`
- [ ] Dockerfile con Node.js 20 + native modules
- [ ] TCP server skeleton (`net.createServer`) en port 6000
- [ ] Healthcheck endpoint en port 8080 (HTTP)
- [ ] Deploy a `gru` (São Paulo · LATAM) y `eze` (Buenos Aires)
- [ ] Smoke test · enviar TCP frame manual

### Sprint A3-4 · Parser Codec 8 + 8E (3-5 días)

- [ ] Implementar parser binario AVL Codec 8
- [ ] Extender a Codec 8E (extended elements)
- [ ] Tests unitarios con frames reales (capturados de Flespi)
- [ ] Mapper de IO elements → CAN snapshot

### Sprint A3-5 · Pipeline a Postgres (2-3 días)

- [ ] Buffer in-memory por asset (max 1 seg de retención)
- [ ] Batch insert cada 1 seg o cada 100 frames (lo que primero)
- [ ] Connection pool persistente con `pg` direct (no Prisma · ms críticos)
- [ ] Idempotency key · `(assetId, recordedAt)` con `ON CONFLICT DO NOTHING`

### Sprint A3-6 · Backpressure y observability (2-3 días)

- [ ] Si el batch insert falla > 3 veces · pause TCP accept temporalmente
- [ ] Si el buffer crece > 10MB · spill a Redis (Upstash)
- [ ] Métricas exportadas via Prometheus endpoint
- [ ] Dashboard Grafana · throughput, latencia, errores

### Sprint A3-7 · Onboarding · primeros 100 devices (1-2 días)

- [ ] Documentar · cómo configurar device Teltonika con endpoint nuevo
- [ ] Migrar 100 devices de prueba · monitorear durante 1 semana
- [ ] Comparar lado-a-lado · Flespi vs worker propio (mismo device, dos endpoints)

### Sprint A3-8 · Migración gradual de devices legacy (mes a mes)

- [ ] Plan de migración con clientes
- [ ] Cambio de endpoint en flotas (coordinado)
- [ ] Decommission gradual de planes Flespi

**Total estimado de Fase 1 (TimescaleDB):** 5-7 días · ejecutable inmediatamente.
**Total estimado de Fase 2 (Worker TCP):** 11-18 días · solo cuando aplique trigger.
**Fase 3 (migración):** continuo, 1-2 meses según volumen.

---

## 7 · Compliance y observabilidad

### 7.1 · Auth de ingestión

#### Flespi (actual)

- Token compartido · `FLESPI_INGEST_TOKEN` env var
- Rotación · trimestral o por incidente

#### Worker TCP propio (futuro)

- Cada device tiene un IMEI único · validable contra tabla `Device`
- Primer frame Teltonika incluye IMEI en el header
- Si IMEI no está registrado · TCP socket cerrado inmediatamente
- Dispositivos también pueden enviar token custom en codec 12

### 7.2 · Multi-tenant en ingestión

Cada `Position` y `Event` insertado debe quedar asociado a una `Account` (vía Asset → Account). El worker no necesita saber el accountId · lo resuelve el lookup `Device.imei → Asset.id → Asset.accountId`.

Compatible con ADR-001 (RLS) · el worker corre con `withSuperAdminScope` (es un cron interno, no un user request).

### 7.3 · Métricas críticas a trackear (post Sprint A3-6)

| Métrica | Threshold |
|---|---|
| Throughput · positions/seg | Esperado: 100-500 hoy · 11.500 a target |
| Latencia E2E · device → DB persist | P50 < 500ms · P95 < 2s |
| Tasa de error · frames inválidos | < 0.1% |
| Buffer size · in-memory pending | < 5 MB sostenidamente |
| Devices conectados (TCP keep-alive) | Todos los registered |
| Postgres write latency | P95 < 50ms |
| Hypertable compression ratio | > 90% |

### 7.4 · Backup y disaster recovery

- **Postgres** · backup diario por Supabase
- **Worker TCP** · sin estado durable propio (solo buffer in-memory + Redis spillover)
- Si worker cae · devices reintentan TCP connect (configurable en Teltonika · default 30s)
- **Failback a Flespi** · si worker está caído > 5 min · re-rutear devices a Flespi (manual o automatizado)

---

## 8 · Anti-patterns que evitar

### 8.1 · Insertar cada posición individualmente

```typescript
// ❌ MAL · 11.500 inserts/seg matará a Postgres
for (const msg of messages) {
  await db.position.create({ data: msg });
}
```

```typescript
// ✅ BIEN · batch insert con createMany
await db.position.createMany({
  data: messages.map(toPositionRow),
  skipDuplicates: true,
});
```

### 8.2 · Conectar a Postgres por cada batch

```typescript
// ❌ MAL · cada batch abre conexión nueva
async function processBatch(messages) {
  const client = await pool.connect();
  try {
    await client.query("INSERT...");
  } finally {
    client.release();
  }
}
```

```typescript
// ✅ BIEN · client persistente del worker
const persistentClient = await pool.connect();
async function processBatch(messages) {
  await persistentClient.query("INSERT...");
}
```

### 8.3 · Ingestión sin idempotencia

Si el device retransmite (timeout) o el worker crashea entre insert y ack:

```typescript
// ❌ MAL · sin idempotencia
await db.$executeRaw`INSERT INTO position (...) VALUES (...)`;
```

```typescript
// ✅ BIEN · ON CONFLICT DO NOTHING con unique key
await db.$executeRaw`
  INSERT INTO position (...) VALUES (...)
  ON CONFLICT (asset_id, recorded_at) DO NOTHING
`;
```

### 8.4 · Almacenar sin retention

Sin retention policy, una tabla normal de Position crece sin límite hasta agotar disco · backup imposible · queries inviables.

```sql
-- ✅ BIEN · retention 12 meses online
SELECT add_retention_policy('Position', INTERVAL '12 months');
```

---

## 9 · Referencias

- TimescaleDB docs · https://docs.timescale.com
- Supabase + TimescaleDB · https://supabase.com/docs/guides/database/extensions/timescaledb
- Teltonika Codec 8 spec · https://wiki.teltonika-gps.com/view/Codec
- Fly.io Machines docs · https://fly.io/docs/machines/
- Fly.io TCP services · https://fly.io/docs/networking/services/
- AG-008 audit · sección "Pipeline TCP de ingestión"
- Maxtracker ADR-001 (multi-tenancy) · necesario para super-admin scope en ingest
- Maxtracker ADR-002 (background jobs) · trade-off vs worker dedicado

---

## 10 · Apéndice · Codec 8 · structure binaria

Frame Teltonika Codec 8 (referencia rápida para Sprint A3-4):

```
┌────────────────────────────────────────────────────────┐
│ Header                                                 │
├──────┬──────────┬──────────┬────────────┬──────────────┤
│ 4B   │ 4B       │ 1B       │ 1B         │ ...          │
│ Pre- │ AVL Data │ Codec ID │ # Records  │ Records...   │
│ amble│ Length   │          │            │              │
└──────┴──────────┴──────────┴────────────┴──────────────┘

Each Record (Codec 8):
┌────────────┬──────────┬──────────────────────┬──────────────────┐
│ 8B         │ 1B       │ 15B                  │ Variable         │
│ Timestamp  │ Priority │ GPS Element          │ IO Element       │
│ (ms unix)  │          │ (lat, lng, alt,      │ (digital, analog,│
│            │          │  speed, heading,     │  CAN, etc.)      │
│            │          │  satellites)         │                  │
└────────────┴──────────┴──────────────────────┴──────────────────┘

Footer:
┌──────────┬──────────────┐
│ 1B       │ 4B           │
│ # Records│ CRC-16/IBM   │
│ (echo)   │              │
└──────────┴──────────────┘
```

Codec 8E extiende los IO Elements con tamaños variables (1B, 2B, 4B, 8B, X·1B) · permite reportar más de 255 elementos por record · necesario para CAN bus completo.

---

## 11 · Apéndice · TimescaleDB schema target

```sql
-- Position como hypertable
SELECT create_hypertable(
  '"Position"',
  'recordedAt',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

CREATE INDEX position_asset_recorded_idx
  ON "Position" ("assetId", "recordedAt" DESC);

-- Compression policy · 95% compression después de 7 días
ALTER TABLE "Position" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"assetId"',
  timescaledb.compress_orderby = '"recordedAt" DESC'
);

SELECT add_compression_policy('"Position"', INTERVAL '7 days');

-- Retention · 12 meses online · luego se borra (puede archivarse a S3 antes)
SELECT add_retention_policy('"Position"', INTERVAL '12 months');

-- Continuous aggregate · km recorridos por asset por día
CREATE MATERIALIZED VIEW position_daily_summary
WITH (timescaledb.continuous) AS
SELECT
  "assetId",
  time_bucket('1 day', "recordedAt") AS day,
  COUNT(*) AS pings,
  -- haversine simplificada
  SUM(
    CASE WHEN lag(lat) OVER w IS NOT NULL THEN
      2 * 6371 * asin(sqrt(
        sin(radians(lat - lag(lat) OVER w) / 2) ^ 2 +
        cos(radians(lag(lat) OVER w)) * cos(radians(lat)) *
        sin(radians(lng - lag(lng) OVER w) / 2) ^ 2
      ))
    ELSE 0 END
  ) AS distance_km
FROM "Position"
WINDOW w AS (PARTITION BY "assetId" ORDER BY "recordedAt")
GROUP BY "assetId", day;

SELECT add_continuous_aggregate_policy('position_daily_summary',
  start_offset => INTERVAL '7 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
```

---

**Decisión:** ✅ Aceptado.

**Acciones inmediatas:** Sprint A3-1 (TimescaleDB · Position hypertable) · 3-4 días · arrancable ya.

**Acciones diferidas:** Sprints A3-3 a A3-8 (Worker TCP) · cuando aplique trigger del §4.
