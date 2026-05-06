// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { notFound } from "next/navigation";
import { getTripById } from "@/lib/queries/trip-detail";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { TripReceipt } from "./TripReceipt";

// ═══════════════════════════════════════════════════════════════
//  /actividad/viaje/[id] · S5-T4
//  ─────────────────────────────────────────────────────────────
//  Recibo imprimible de un viaje (Trip) individual. La URL no
//  lleva /print/ porque está en el route group (print) de
//  Next.js · ese grupo aplica el layout sin sidebar/topbar y
//  CSS @page para A4. La URL pública queda limpia.
//
//  Multi-tenant · respeta scope. Si el trip no pertenece al
//  account del usuario, notFound().
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ViajeReciboPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "actividad", null);

  const trip = await getTripById(id, scopedAccountId);
  if (!trip) {
    notFound();
  }

  return (
    <TripReceipt
      trip={trip}
      generatedBy={session.user.fullName}
      generatedAtIso={new Date().toISOString()}
    />
  );
}
