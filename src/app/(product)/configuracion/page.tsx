import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ConfiguracionShell } from "./ConfiguracionShell";
import styles from "./ConfiguracionPage.module.css";

// ═══════════════════════════════════════════════════════════════
//  /configuracion (S1)
//  ─────────────────────────────────────────────────────────────
//  Configuración con sidebar contextual estilo Notion/Linear.
//
//  Estructura:
//
//    MI CUENTA (todos los users)
//      · Mi perfil
//      · Notificaciones
//      · Preferencias
//      · Seguridad
//
//    EMPRESA (solo CLIENT_ADMIN, MAXTRACKER_ADMIN, SUPER_ADMIN)
//      · Datos de la cuenta
//      · Umbrales y alarmas
//      · Integraciones
//      · Plan y facturación
//      · Usuarios y permisos
//
//  Section accesible vía ?section=perfil|notificaciones|...
//  Default = perfil
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export type SectionKey =
  // Personal
  | "perfil"
  | "notificaciones"
  | "preferencias"
  | "seguridad"
  // Empresa
  | "empresa-datos"
  | "empresa-umbrales"
  | "empresa-integraciones"
  | "empresa-plan"
  | "empresa-usuarios";

const PERSONAL_SECTIONS: SectionKey[] = [
  "perfil",
  "notificaciones",
  "preferencias",
  "seguridad",
];

const EMPRESA_SECTIONS: SectionKey[] = [
  "empresa-datos",
  "empresa-umbrales",
  "empresa-integraciones",
  "empresa-plan",
  "empresa-usuarios",
];

const ALL_SECTIONS: SectionKey[] = [...PERSONAL_SECTIONS, ...EMPRESA_SECTIONS];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConfiguracionPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sectionRaw = sp.section;
  const sectionParam = Array.isArray(sectionRaw) ? sectionRaw[0] : sectionRaw;
  const requestedSection: SectionKey = ALL_SECTIONS.includes(
    sectionParam as SectionKey,
  )
    ? (sectionParam as SectionKey)
    : "perfil";

  const session = await getSession();
  const canSeeEmpresa =
    session.profile.systemKey === "CLIENT_ADMIN" ||
    session.profile.systemKey === "MAXTRACKER_ADMIN" ||
    session.profile.systemKey === "SUPER_ADMIN";

  // Si OPERATOR pidió una sección de empresa, redirigir a perfil
  if (
    !canSeeEmpresa &&
    EMPRESA_SECTIONS.includes(requestedSection)
  ) {
    redirect("/configuracion?section=perfil");
  }

  // Para secciones de empresa, cargar el account + settings
  let accountWithSettings = null;
  if (canSeeEmpresa && session.account?.id) {
    accountWithSettings = await db.account.findUnique({
      where: { id: session.account.id },
      include: { settings: true },
    });
  }

  // Para usuarios y permisos · listar users del account
  let accountUsers = null;
  if (canSeeEmpresa && requestedSection === "empresa-usuarios" && session.account?.id) {
    accountUsers = await db.user.findMany({
      where: { accountId: session.account.id },
      include: { profile: true },
      orderBy: [{ status: "asc" }, { firstName: "asc" }],
    });
  }

  // Catálogo de perfiles asignables (solo CLIENT_ADMIN y OPERATOR)
  const assignableProfiles =
    canSeeEmpresa && requestedSection === "empresa-usuarios"
      ? await db.profile.findMany({
          where: { systemKey: { in: ["CLIENT_ADMIN", "OPERATOR"] } },
          orderBy: { systemKey: "asc" },
        })
      : null;

  return (
    <div className={styles.page}>
      <ConfiguracionShell
        session={session}
        activeSection={requestedSection}
        canSeeEmpresa={canSeeEmpresa}
        account={accountWithSettings}
        accountUsers={accountUsers}
        assignableProfiles={assignableProfiles}
      />
    </div>
  );
}
