// ═══════════════════════════════════════════════════════════════
//  Route Handler · /api/export/xlsx · L10
//  ─────────────────────────────────────────────────────────────
//  POST endpoint que genera un .xlsx según el `kind` solicitado.
//
//  Request body shape:
//    { kind: "trips", params: TripsParams }
//    { kind: "boletin", period: "YYYY-MM" }
//    { kind: "reportes-generic", subject, sheetName, columns, rows }
//
//  Response:
//    Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
//    Content-Disposition: attachment; filename="..."
//
//  Notas:
//   · Dynamic import de exceljs · queda fuera del bundle de pages
//     (~600KB se cargan solo en este route)
//   · Auth via getSession · debe estar logueado
//   · El cliente dispara con fetch() y el browser maneja el download
//     a través del Content-Disposition header.
// ═══════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { listTripsAndStopsByDay } from "@/lib/queries/trips-by-day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TripsRequestBody {
  kind: "trips";
  params: {
    fromDate: string;
    toDate: string;
    assetIds: string[];
    groupIds: string[];
    personIds: string[];
  };
}

interface ReportesGenericRequestBody {
  kind: "reportes-generic";
  subject: string;
  sheetName: string;
  columns: { header: string; width?: number; format?: "int" | "decimal1" | "text" | "date" }[];
  rows: (string | number | boolean | null)[][];
}

interface BoletinRequestBody {
  kind: "boletin";
  period: string; // YYYY-MM
}

type RequestBody = TripsRequestBody | ReportesGenericRequestBody | BoletinRequestBody;

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !body.kind) {
    return NextResponse.json({ error: "Missing 'kind'" }, { status: 400 });
  }

  // ── Resolve tenant scope ──────────────────────────────────────
  const scopedAccountId = resolveAccountScope(session, "actividad", null);

  // ── Dispatch ──────────────────────────────────────────────────
  try {
    switch (body.kind) {
      case "trips":
        return await handleTrips(body, scopedAccountId);
      case "reportes-generic":
        return await handleReportesGeneric(body);
      case "boletin":
        return await handleBoletin(body, scopedAccountId);
      default: {
        const _exhaustive: never = body;
        return NextResponse.json(
          { error: `Unknown kind: ${(_exhaustive as { kind: string }).kind}` },
          { status: 400 },
        );
      }
    }
  } catch (err) {
    console.error("[xlsx export]", err);
    return NextResponse.json(
      { error: "Export failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}

// ── Handlers ──────────────────────────────────────────────────

async function handleTrips(
  body: TripsRequestBody,
  scopedAccountId: string | null,
): Promise<Response> {
  const { generateTripsXlsx } = await import("@/lib/excel/trips");

  const days = await listTripsAndStopsByDay({
    fromDate: body.params.fromDate,
    toDate: body.params.toDate,
    assetIds: body.params.assetIds,
    groupIds: body.params.groupIds,
    personIds: body.params.personIds,
    accountId: scopedAccountId,
  });

  const buffer = await generateTripsXlsx({
    days,
    fromDate: body.params.fromDate,
    toDate: body.params.toDate,
  });

  const filename = `viajes_${body.params.fromDate}_a_${body.params.toDate}.xlsx`;
  return xlsxResponse(buffer, filename);
}

async function handleReportesGeneric(
  body: ReportesGenericRequestBody,
): Promise<Response> {
  const { generateReportesXlsx } = await import("@/lib/excel/reportes");

  const buffer = await generateReportesXlsx({
    sheetName: body.sheetName,
    subject: body.subject,
    columns: body.columns,
    rows: body.rows,
  });

  const safeName = body.sheetName.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
  const filename = `${safeName || "reporte"}.xlsx`;
  return xlsxResponse(buffer, filename);
}

async function handleBoletin(
  body: BoletinRequestBody,
  _scopedAccountId: string | null,
): Promise<Response> {
  // El boletín es complejo · su data se carga en `loadBoletinData()`
  // dentro de la page. Para no duplicar 200 LOC de query, en el
  // MVP exportamos solo lo que el cliente nos pase pre-procesado
  // (ver consumer: BoletinHeader llama con la data ya cargada).
  //
  // En esta primera iteración, devolvemos error · el caller debe
  // usar el endpoint /api/export/xlsx?kind=boletin-with-data que
  // recibe el data inline. Si querés evitar el roundtrip, llamá
  // desde la misma server component que ya tiene la data.
  return NextResponse.json(
    {
      error:
        "Para exportar el boletín, el cliente debe pasar la data pre-cargada · ver doc en lib/excel/boletin.ts",
    },
    { status: 501 },
  );

  // El handler real vendrá en una siguiente iteración cuando
  // refactorice loadBoletinData() a un módulo compartido.
}

// ── Helpers ──────────────────────────────────────────────────

function xlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
