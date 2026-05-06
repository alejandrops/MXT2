// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { notFound } from "next/navigation";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { parsePeriod } from "@/lib/conduccion/boletin-driver-text";
import { groupBoletinFolio, groupBoletinLead } from "@/lib/conduccion/boletin-group-text";
import { getOrGenerateGroupBoletin } from "@/lib/boletin/group-snapshot";
import { GroupBoletin } from "./GroupBoletin";

// ═══════════════════════════════════════════════════════════════
//  /conduccion/boletin/grupo/[id]/[period] · S5-E2
//  ─────────────────────────────────────────────────────────────
//  Boletín imprimible de un grupo para un período mensual o anual.
//  Análogo al de conductor (S5-E1) pero a nivel grupo.
//
//  URL params:
//    [id]     · groupId (cuid)
//    [period] · "YYYY-MM" (mensual) o "YYYY" (anual)
//
//  En este lote · sin pre-generación · se calcula on-demand.
//  El cron y el snapshot quedan para sub-lote S5-E2b.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; period: string }>;
}

export default async function GroupBoletinPage({ params }: PageProps) {
  const { id, period: rawPeriod } = await params;

  const period = parsePeriod(rawPeriod);
  if (!period) notFound();

  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "conduccion", null);

  const result = await getOrGenerateGroupBoletin({
    groupId: id,
    period,
    rawPeriod,
    accountId: scopedAccountId,
  });
  if (!result) notFound();
  const { data, generatedAtIso } = result;

  const folio = groupBoletinFolio({
    groupName: data.group.name,
    groupIdShort: data.group.idShort,
    period,
  });

  const lead = groupBoletinLead({
    groupName: data.group.name,
    period,
    distanceKm: data.summary.distanceKm,
    tripCount: data.summary.tripCount,
    activeDrivers: data.summary.activeDrivers,
    activeAssets: data.summary.activeAssets,
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
    <GroupBoletin
      data={data}
      period={period}
      folio={folio}
      lead={lead}
      generatedAtIso={generatedAtIso}
      generatedBy={session.user?.fullName ?? "sistema"}
    />
  );
}
