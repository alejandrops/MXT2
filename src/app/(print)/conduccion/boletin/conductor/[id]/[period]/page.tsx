// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { notFound } from "next/navigation";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import {
  parsePeriod,
  boletinFolio,
  boletinNarrativeLead,
  boletinUniqueId,
} from "@/lib/conduccion/boletin-driver-text";
import { getOrGenerateDriverBoletin } from "@/lib/boletin/driver-snapshot";
import { DriverBoletin } from "./DriverBoletin";

// ═══════════════════════════════════════════════════════════════
//  /conduccion/boletin/conductor/[id]/[period] · S5-E1
//  ─────────────────────────────────────────────────────────────
//  Boletín imprimible de un conductor para un período mensual o
//  anual. Vive en route group (print) · sin sidebar/topbar y CSS
//  @page A4.
//
//  URL params:
//    [id]     · driverId (cuid)
//    [period] · "YYYY-MM" (mensual) o "YYYY" (anual)
//
//  Pre-generación con fallback on-demand · ver driver-snapshot.ts
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; period: string }>;
}

export default async function DriverBoletinPage({ params }: PageProps) {
  const { id, period: rawPeriod } = await params;

  // Validar formato del período
  const period = parsePeriod(rawPeriod);
  if (!period) notFound();

  // Multi-tenant scope
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "actividad", null);

  // Cargar boletín con fallback on-demand
  const result = await getOrGenerateDriverBoletin({
    driverId: id,
    period,
    rawPeriod,
    accountId: scopedAccountId,
  });
  if (!result) notFound();

  const { data, generatedAtIso } = result;

  // Generar lead narrativo y folio
  const folio = boletinFolio({
    driverFirstName: data.driver.firstName,
    driverLastName: data.driver.lastName,
    driverIdShort: data.driver.idShort,
    period,
  });

  const lead = boletinNarrativeLead({
    driverFirstName: data.driver.firstName,
    period,
    distanceKm: data.summary.distanceKm,
    tripCount: data.summary.tripCount,
    infractionCount: data.infractions.total,
    leveCount: data.infractions.leve,
    mediaCount: data.infractions.media,
    graveCount: data.infractions.grave,
    score: data.summary.score,
    prevScore: data.prev.score,
    monthsInGreen: data.monthsInGreen ?? undefined,
    totalMonths: period.kind === "annual" ? 12 : undefined,
  });

  return (
    <DriverBoletin
      data={data}
      period={period}
      folio={folio}
      uniqueId={boletinUniqueId(id)}
      lead={lead}
      generatedAtIso={generatedAtIso}
      generatedBy={session.user?.fullName ?? "sistema"}
    />
  );
}
