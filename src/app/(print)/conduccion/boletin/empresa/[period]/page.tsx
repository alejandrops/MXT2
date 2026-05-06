// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { notFound } from "next/navigation";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { parsePeriod } from "@/lib/conduccion/boletin-driver-text";
import {
  accountBoletinFolio,
  accountBoletinLead,
} from "@/lib/conduccion/boletin-account-text";
import { getAccountBoletinData } from "@/lib/queries/account-boletin-data";
import { AccountBoletin } from "./AccountBoletin";

// ═══════════════════════════════════════════════════════════════
//  /conduccion/boletin/empresa/[period] · S5-E3
//  ─────────────────────────────────────────────────────────────
//  Boletín ejecutivo de toda la empresa (cuenta).
//  Cross-grupo · ranking de grupos · scatter de grupos.
//
//  URL params:
//    [period] · "YYYY-MM" (mensual) o "YYYY" (anual)
//
//  La empresa se infiere del scope del usuario:
//    · CA / OP   · su propia cuenta (resolveAccountScope)
//    · MA / SA   · la cuenta pasada por ?account= (o la primera)
//
//  Sin pre-generación · cómputo on-demand. Snapshot queda
//  para sub-lote S5-E3b si se pide.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ period: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountBoletinPage({
  params,
  searchParams,
}: PageProps) {
  const { period: rawPeriod } = await params;
  const sp = await searchParams;

  const period = parsePeriod(rawPeriod);
  if (!period) notFound();

  const session = await getSession();

  // Account explícito (para SA/MA) o el del scope del usuario
  const explicitAccount =
    typeof sp.account === "string" ? sp.account : null;
  const scopedAccountId = resolveAccountScope(
    session,
    "conduccion",
    explicitAccount,
  );

  // Si scopedAccountId es null (SA cross-tenant sin filtro) · falla
  if (!scopedAccountId) {
    notFound();
  }

  const data = await getAccountBoletinData({
    accountId: scopedAccountId,
    period,
  });
  if (!data) notFound();

  const folio = accountBoletinFolio({
    accountName: data.account.name,
    accountIdShort: data.account.idShort,
    period,
  });

  const lead = accountBoletinLead({
    accountName: data.account.name,
    period,
    distanceKm: data.summary.distanceKm,
    tripCount: data.summary.tripCount,
    activeDrivers: data.summary.activeDrivers,
    activeAssets: data.summary.activeAssets,
    activeGroups: data.summary.activeGroups,
    totalGroups: data.account.groupsCount,
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
    <AccountBoletin
      data={data}
      period={period}
      folio={folio}
      lead={lead}
      generatedAtIso={new Date().toISOString()}
      generatedBy={session.user?.fullName ?? "sistema"}
    />
  );
}
