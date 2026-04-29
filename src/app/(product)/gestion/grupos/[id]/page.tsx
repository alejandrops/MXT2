import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /gestion/grupos/[id] · redirige al Libro del Grupo
//  ─────────────────────────────────────────────────────────────
//  Por consistencia con vehículos y conductores · si alguien
//  arma la URL manualmente o llega por un link externo, lo
//  llevamos al Libro del Grupo.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/objeto/grupo/${id}`);
}
