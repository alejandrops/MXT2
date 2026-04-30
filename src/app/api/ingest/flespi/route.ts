import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { mapFlespiMessage } from "@/lib/ingestion/flespi-mapper";
import { processTripDetection } from "@/lib/ingestion/trip-detection";
import { ingestionMetrics } from "@/lib/ingestion/metrics";
import type {
  FlespiMessage,
  IngestSummary,
  MessageResult,
  SkipReason,
} from "@/lib/ingestion/flespi-types";

// ═══════════════════════════════════════════════════════════════
//  POST /api/ingest/flespi (I1)
//  ─────────────────────────────────────────────────────────────
//  Webhook receiver para los streams HTTPS push de flespi.
//
//  Auth:
//   · Header `X-Flespi-Token: <FLESPI_INGEST_TOKEN>` o
//     `Authorization: Bearer <FLESPI_INGEST_TOKEN>`.
//   · El token se configura como variable de entorno y también
//     en el panel de flespi al crear el stream HTTPS.
//
//  Payload:
//   · Array de messages JSON · ej. [{ ident, timestamp, position.* }, ...]
//   · O un único message como objeto · lo envolvemos en array.
//
//  Procesamiento:
//   1. Auth · si falla → 401
//   2. Parse JSON · si falla → 400
//   3. Por cada message:
//      a. Mapper validation
//      b. Match ident → Device.imei → assetId
//      c. Persistir Position + upsert LivePosition + update Device.lastSeenAt
//   4. Devolver IngestSummary con counts y sample de errores
//
//  Estrategia de errores: tolerante al batch · un message malo
//  no falla el resto. Devolvemos siempre 200 OK con detail (excepto
//  para errores estructurales como auth o JSON malformado).
//
//  Performance v1:
//   · Una sola query findMany para todos los IMEIs del batch
//   · createMany para todas las Positions de un solo viaje
//   · Update individual de LivePosition y Device.lastSeenAt · podría
//     optimizarse con raw SQL después si hace falta
//
//  Idempotencia:
//   · Sin unique constraint en Position(assetId, recordedAt) por
//     ahora · si flespi reenvía el mismo message (timeout), se
//     duplica. Aceptable para v1 · si aparece como problema en
//     testing, agregamos el constraint en un siguiente lote.
// ═══════════════════════════════════════════════════════════════

const MAX_DETAILS_RETURNED = 50;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────
  const expectedToken = process.env.FLESPI_INGEST_TOKEN;
  if (!expectedToken || expectedToken.length === 0) {
    console.error("[ingest/flespi] FLESPI_INGEST_TOKEN no configurado");
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  const headerToken =
    request.headers.get("x-flespi-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (headerToken !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── 2. Parse body ────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_json", detail: e instanceof Error ? e.message : "" },
      { status: 400 },
    );
  }

  const messages: FlespiMessage[] = Array.isArray(raw)
    ? (raw as FlespiMessage[])
    : raw && typeof raw === "object"
      ? [raw as FlespiMessage]
      : [];

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "empty_payload" },
      { status: 400 },
    );
  }

  // ── 3. Map todos los messages ─────────────────────────────────
  const mapped: Array<
    | { ok: true; data: ReturnType<typeof mapFlespiMessage> & { ok: true } }
    | { ok: false; reason: SkipReason; ident?: string; detail?: string }
  > = [];

  const idents = new Set<string>();

  for (const msg of messages) {
    const result = mapFlespiMessage(msg);
    if (result.ok) {
      idents.add(result.data.ident);
      mapped.push({ ok: true, data: result });
    } else {
      mapped.push({
        ok: false,
        reason: result.reason,
        ident: typeof msg.ident === "string" ? msg.ident : undefined,
        detail: result.detail,
      });
    }
  }

  // ── 4. Resolver IMEIs a Device.assetId en una sola query ────
  const devices = await db.device.findMany({
    where: { imei: { in: Array.from(idents) } },
    select: {
      id: true,
      imei: true,
      assetId: true,
      status: true,
    },
  });
  const deviceByImei = new Map(devices.map((d) => [d.imei, d]));

  // ── 5. Persistir mapped ───────────────────────────────────────
  const summary: IngestSummary = {
    received: messages.length,
    ok: 0,
    skipped: 0,
    errors: 0,
    skips_by_reason: {},
    details: [],
  };

  function record(result: MessageResult) {
    if (result.status === "ok") summary.ok++;
    else if (result.status === "skipped") {
      summary.skipped++;
      summary.skips_by_reason[result.reason] =
        (summary.skips_by_reason[result.reason] ?? 0) + 1;
    } else summary.errors++;

    if (
      result.status !== "ok" &&
      summary.details.length < MAX_DETAILS_RETURNED
    ) {
      summary.details.push(result);
    }
  }

  // Acumulamos todo lo que vamos a insertar para hacer un createMany
  type PositionRow = {
    assetId: string;
    recordedAt: Date;
    lat: number;
    lng: number;
    speedKmh: number;
    heading: number | null;
    ignition: boolean;
  };
  const positionsToInsert: PositionRow[] = [];

  // Para LivePosition · nos quedamos con el más reciente por asset
  const latestByAsset = new Map<string, PositionRow>();

  // Para lastSeenAt del Device · nos quedamos con el más reciente por device
  const lastSeenByDevice = new Map<string, Date>();

  for (const m of mapped) {
    if (!m.ok) {
      record({
        status: "skipped",
        reason: m.reason,
        ident: m.ident,
        detail: m.detail,
      });
      continue;
    }

    const data = m.data.data;
    const dev = deviceByImei.get(data.ident);

    if (!dev) {
      record({
        status: "skipped",
        reason: "unknown_imei",
        ident: data.ident,
        detail: `IMEI ${data.ident} no existe en el sistema`,
      });
      continue;
    }

    if (!dev.assetId || dev.status !== "INSTALLED") {
      record({
        status: "skipped",
        reason: "device_unassigned",
        ident: data.ident,
        detail: `device en estado ${dev.status} · sin asset asignado`,
      });
      continue;
    }

    const row: PositionRow = {
      assetId: dev.assetId,
      recordedAt: data.recordedAt,
      lat: data.lat,
      lng: data.lng,
      speedKmh: data.speedKmh,
      heading: data.heading,
      ignition: data.ignition,
    };
    positionsToInsert.push(row);

    // Track latest por asset (LivePosition)
    const prev = latestByAsset.get(dev.assetId);
    if (!prev || row.recordedAt > prev.recordedAt) {
      latestByAsset.set(dev.assetId, row);
    }

    // Track latest por device (lastSeenAt)
    const prevSeen = lastSeenByDevice.get(dev.id);
    if (!prevSeen || row.recordedAt > prevSeen) {
      lastSeenByDevice.set(dev.id, row.recordedAt);
    }

    record({ status: "ok", assetId: dev.assetId, ident: data.ident });
  }

  // ── 6. Inserts batch ───────────────────────────────────────────
  let duplicates = 0;
  if (positionsToInsert.length > 0) {
    try {
      // skipDuplicates depende de @@unique([assetId, recordedAt]) en
      // Position. Si la migration está aplicada, los duplicados se
      // ignoran silenciosamente y `result.count` < positionsToInsert.length.
      // Si la migration NO está, skipDuplicates es no-op y todos se
      // insertan (puede haber rows con misma (assetId, recordedAt)).
      const result = await db.position.createMany({
        data: positionsToInsert,
        skipDuplicates: true,
      });
      duplicates = positionsToInsert.length - result.count;

      // LivePosition · upsert por asset
      await Promise.all(
        Array.from(latestByAsset.entries()).map(([assetId, row]) =>
          db.livePosition.upsert({
            where: { assetId },
            create: {
              assetId,
              recordedAt: row.recordedAt,
              lat: row.lat,
              lng: row.lng,
              speedKmh: row.speedKmh,
              heading: row.heading,
              ignition: row.ignition,
            },
            update: {
              recordedAt: row.recordedAt,
              lat: row.lat,
              lng: row.lng,
              speedKmh: row.speedKmh,
              heading: row.heading,
              ignition: row.ignition,
              updatedAt: new Date(),
            },
          }),
        ),
      );

      // Device.lastSeenAt · update batch
      await Promise.all(
        Array.from(lastSeenByDevice.entries()).map(([deviceId, ts]) =>
          db.device.update({
            where: { id: deviceId },
            data: { lastSeenAt: ts },
          }),
        ),
      );
    } catch (err) {
      console.error("[ingest/flespi] error en persistencia", err);
      return NextResponse.json(
        {
          error: "persistence_error",
          detail: err instanceof Error ? err.message : String(err),
          summary,
        },
        { status: 500 },
      );
    }
  }

  // ── 7. Trip detection sobre los assets afectados (I3) ─────────
  // Iteramos sobre los assets que recibieron al menos una position
  // en este batch. Cada uno se evalúa independientemente · si el
  // asset acaba de pasar a ignition=false y hay un bloque previo
  // de ignition=true, se cierra Trip.
  let tripSummary = { tripsCreated: 0, tripsDiscarded: 0, errors: 0 };
  if (latestByAsset.size > 0) {
    try {
      const td = await processTripDetection(Array.from(latestByAsset.keys()));
      tripSummary = {
        tripsCreated: td.tripsCreated,
        tripsDiscarded: td.tripsDiscarded,
        errors: td.errors.length,
      };
      if (td.errors.length > 0) {
        console.error("[ingest/flespi] trip detection errors", td.errors);
      }
    } catch (err) {
      // No queremos que un fallo en trip detection rompa la response
      // del ingestion · ya guardamos los datos crudos.
      console.error("[ingest/flespi] trip detection failed", err);
    }
  }

  // ── 8. Registrar en metrics + log ─────────────────────────────
  ingestionMetrics.recordBatch(summary, duplicates, {
    tripsCreated: tripSummary.tripsCreated,
    tripsDiscarded: tripSummary.tripsDiscarded,
  });

  console.log(
    `[ingest/flespi] received=${summary.received} ok=${summary.ok} ` +
      `skipped=${summary.skipped} errors=${summary.errors} ` +
      `duplicates=${duplicates} ` +
      `trips_created=${tripSummary.tripsCreated} ` +
      `trips_discarded=${tripSummary.tripsDiscarded}`,
  );

  return NextResponse.json(
    { ...summary, duplicates, trips: tripSummary },
    { status: 200 },
  );
}

// GET para healthcheck rápido
export async function GET() {
  const tokenSet = !!process.env.FLESPI_INGEST_TOKEN;
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/ingest/flespi",
    token_configured: tokenSet,
  });
}
