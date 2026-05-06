# Cron patterns · Maxtracker

Patrones implementados en los crons del repo · documentados para handoff y como referencia para crons futuros.

Ver el ADR de fondo · [ADR-002 · Background jobs architecture](./ADR-002-background-jobs.md).

## 1 · Auth con CRON_SECRET

Todo cron protegido con header `Authorization: Bearer $CRON_SECRET`.

```typescript
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // ...
}
```

Vercel inyecta este header automáticamente en las llamadas de cron schedules. Para testing manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.maxtracker.com/api/cron/generate-fleet-boletines
```

## 2 · Falla suave por entidad

Cada cron itera entidades · si una falla, se loggea y se sigue con el resto. **Nunca aborta el cron entero por un error puntual.**

```typescript
const results: EntityResult[] = [];
let totalGenerated = 0;
let totalErrors = 0;

for (const entity of activeEntities) {
  const r: EntityResult = { id: entity.id, generated: [], errors: [] };

  try {
    await processEntity(entity);
    r.generated.push("ok");
    totalGenerated++;
  } catch (e: any) {
    r.errors.push(e?.message ?? "unknown");
    totalErrors++;
  }

  if (r.errors.length > 0) results.push(r);
}

return NextResponse.json({
  ok: true,
  totalGenerated,
  totalErrors,
  details: totalErrors > 0 ? results : undefined,
});
```

## 3 · Lógica de regeneración temporal

Al cierre de cada día · regenerar el período en curso. Más casos especiales:

```typescript
const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000); // ART
const year = todayLocal.getUTCFullYear();
const month = todayLocal.getUTCMonth() + 1;
const day = todayLocal.getUTCDate();

const periodsToGenerate: string[] = [
  `${year}-${String(month).padStart(2, "0")}`, // siempre · mes en curso
];

if (day === 1) {
  // 1° del mes · cerrar el mes anterior
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  periodsToGenerate.unshift(`${prevYear}-${String(prevMonth).padStart(2, "0")}`);
  // 1° de cualquier mes · regenerar el año en curso
  periodsToGenerate.push(String(year));
}

if (day === 1 && month === 1) {
  // 1° de enero · cerrar el año anterior
  periodsToGenerate.push(String(year - 1));
}
```

## 4 · Activos = con actividad reciente

Para no procesar entidades dormidas, filtrar por `assetDriverDay` reciente:

```typescript
const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

const activeAssetIds = await db.assetDriverDay.findMany({
  where: { day: { gte: since60d } },
  select: { assetId: true },
  distinct: ["assetId"],
});
```

Esto reduce drásticamente el volumen del cron · de "todos los conductores históricos" a "los que tuvieron actividad en los últimos 60 días".

## 5 · Schedules separados por 15 min

Para evitar que múltiples crons compitan por recursos al mismo tiempo:

```json
{
  "crons": [
    { "path": "/api/cron/generate-boletines",        "schedule": "0 6 * * *" },
    { "path": "/api/cron/generate-driver-boletines", "schedule": "15 6 * * *" },
    { "path": "/api/cron/generate-fleet-boletines",  "schedule": "30 6 * * *" }
  ]
}
```

3 schedules con 15 min de gap. El más liviano arranca primero (cuenta operativa), los más pesados después.

## 6 · maxDuration explícito

Default Vercel = 10 segundos. Cualquier cron real necesita más.

```json
{
  "functions": {
    "src/app/api/cron/generate-fleet-boletines/route.ts": {
      "maxDuration": 60
    }
  }
}
```

Para crons que pueden superar 60s sostenidamente · revisar limit del plan Vercel actual y considerar migrar a Inngest (ver ADR-002 §4.1).

## 7 · Helper getOrGenerate · fallback on-demand

Cuando un cron no corrió todavía o falló para una entidad puntual, la lectura debe seguir funcionando · cae a on-demand:

```typescript
export async function getOrGenerateXBoletin(args: SnapshotArgs) {
  // 1. Intentar leer cache · falla suave si la tabla no existe
  let cached: { payload: any; generatedAt: Date } | null = null;
  try {
    cached = await db.xBoletinSnapshot.findUnique({ where: { ... } });
  } catch {
    cached = null;
  }
  if (cached && isValidPayload(cached.payload)) {
    return { data: cached.payload, source: "snapshot-cache", ... };
  }

  // 2. Computar on-demand
  const data = await getXBoletinData({ ... });
  if (!data) return null;

  // 3. Intentar guardar · si la tabla no existe, NO romper
  try {
    await db.xBoletinSnapshot.upsert({ ... });
    return { data, source: "on-demand-saved", ... };
  } catch {
    return { data, source: "on-demand-no-cache", ... };
  }
}
```

Permite que el lote se aplique antes de la migración Prisma · no rompe el flujo si la tabla snapshot no existe todavía.

## 8 · Multi-tenant scope en crons

Crons que generan datos por cuenta deben respetar el modelo de scope. Los crons internos corren con privilegios elevados · usan `accountId: null` o equivalente. **No deben** confundir con queries de UI:

```typescript
// ✅ BIEN · cron explícitamente cross-tenant
const data = await getDriverBoletinData({
  driverId,
  period,
  accountId: null, // null = no filter · cross-tenant porque es cron interno
});

// ❌ MAL · sería intento de scope desde un contexto sin sesión real
const data = await getDriverBoletinData({
  driverId,
  period,
  accountId: someAccountIdFromQueryString, // ← cron NO tiene query string
});
```

## 9 · Output del cron · siempre JSON estructurado

```typescript
return NextResponse.json({
  ok: true,
  elapsedMs: Date.now() - startedAt,
  elapsedSec: Math.round(elapsedMs / 1000),
  periodsAttempted: periodsToGenerate,
  groupsTotal: activeGroups.length,
  accountsTotal: activeAccounts.length,
  boletinesGenerated: totalGenerated,
  errors: totalErrors,
  details: totalErrors > 0 ? results.filter((r) => r.errors.length > 0) : undefined,
});
```

Permite consultar el último output desde Vercel logs y entender el estado del run.

## 10 · Anti-patterns · NO HACER

Ver ADR-002 §8 · 4 anti-patterns documentados con ejemplos:

- Cron que computa todo "in process" sin atomicidad
- Cron sin auth (público accidental)
- Cron sin maxDuration explícito
- Cron que asume horario sin TZ
