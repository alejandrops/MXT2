// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { notFound } from "next/navigation";
import { getInfractionById } from "@/lib/queries/infractions-list";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { InfractionReceipt } from "./InfractionReceipt";

// ═══════════════════════════════════════════════════════════════
//  /conduccion/infraccion/[id] · S4-L3d
//  ─────────────────────────────────────────────────────────────
//  Recibo imprimible de una infracción individual. La URL no
//  lleva /print/ porque está en el route group (print) de
//  Next.js · ese grupo aplica el layout sin sidebar/topbar y
//  CSS @page para A4. La URL pública queda limpia.
//
//  Multi-tenant · respeta scope. Si la infracción no pertenece
//  al account del usuario (caso CA/OP intentando ver una de
//  otra cuenta), notFound().
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InfraccionReciboPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "actividad", null);

  const infraction = await getInfractionById(id, scopedAccountId);
  if (!infraction) {
    notFound();
  }

  return (
    <InfractionReceipt
      infraction={infraction}
      generatedBy={session.user.fullName}
      generatedAtIso={new Date().toISOString()}
    />
  );
}
