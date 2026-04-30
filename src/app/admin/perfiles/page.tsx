import { redirect } from "next/navigation";
import { Pencil, Lock, Eye } from "lucide-react";
import { listProfilesWithUserCounts, getProfileForEdit } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { canRead, canWrite } from "@/lib/permissions";
import { ProfileEditDrawer } from "./ProfileEditDrawer";
import { ProfileEditTrigger } from "./ProfileEditTrigger";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/perfiles · matriz de los 4 perfiles builtin (B2)
//  ─────────────────────────────────────────────────────────────
//  Lista plana de perfiles con conteo de usuarios. Click en un
//  perfil abre el drawer · si actor es SA, modo edición. Si MA,
//  modo solo lectura. CA y OP no entran (redirect a /admin).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN:
    "Acceso total al producto y backoffice · perfil del sistema, no editable.",
  MAXTRACKER_ADMIN:
    "Operación cross-cliente · sin gestión de Super admins.",
  CLIENT_ADMIN:
    "Administra usuarios y catálogos de su propio cliente.",
  OPERATOR:
    "Solo lectura de operación de su propio cliente.",
};

const PROFILE_BADGE_CLASS: Record<string, string> = {
  SUPER_ADMIN: "badgeSa",
  MAXTRACKER_ADMIN: "badgeMa",
  CLIENT_ADMIN: "badgeCa",
  OPERATOR: "badgeOp",
};

interface PageProps {
  searchParams: Promise<{ edit?: string | string[] }>;
}

export default async function PerfilesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const editIdRaw = sp.edit;
  const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;

  const session = await getSession();
  if (!canRead(session, "backoffice_perfiles")) {
    redirect("/admin");
  }
  const userCanWrite = canWrite(session, "backoffice_perfiles");

  const profiles = await listProfilesWithUserCounts();

  let drawerInitial: Awaited<ReturnType<typeof getProfileForEdit>> = null;
  if (editId) {
    drawerInitial = await getProfileForEdit(editId);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Perfiles</h1>
          <p className={styles.subtitle}>
            {userCanWrite
              ? "Definí qué puede ver y hacer cada tipo de usuario en el sistema"
              : "Solo lectura · solo Super admin puede modificar perfiles"}
          </p>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Perfil</th>
              <th className={styles.th}>Descripción</th>
              <th className={`${styles.th} ${styles.thRight}`}>Usuarios</th>
              <th className={styles.thAction} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const badgeClass = PROFILE_BADGE_CLASS[p.systemKey] ?? "";
              const description = PROFILE_DESCRIPTIONS[p.systemKey] ?? "—";
              const isSystem = p.systemKey === "SUPER_ADMIN";

              return (
                <tr key={p.id} className={styles.row}>
                  <td className={styles.td}>
                    <div className={styles.profileCell}>
                      <span
                        className={`${styles.badge} ${styles[badgeClass] ?? ""}`}
                      >
                        {p.nameLabel}
                      </span>
                      {isSystem && (
                        <span className={styles.systemTag}>
                          <Lock size={11} /> Sistema
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.dim}>{description}</span>
                  </td>
                  <td className={`${styles.td} ${styles.tdRight}`}>
                    <span className={styles.count}>{p.userCount}</span>
                  </td>
                  <td className={`${styles.td} ${styles.tdAction}`}>
                    <ProfileEditTrigger
                      profileId={p.id}
                      label={
                        isSystem
                          ? "Ver"
                          : userCanWrite
                            ? "Editar"
                            : "Ver"
                      }
                      icon={
                        isSystem || !userCanWrite ? (
                          <Eye size={13} />
                        ) : (
                          <Pencil size={13} />
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.note}>
        <strong>Nota:</strong> los cambios de permisos impactan inmediatamente
        en los usuarios asignados. Si quitás <em>Lectura</em> de un módulo, los
        operadores con ese perfil dejan de ver el item en el sidebar y no
        pueden navegar a él.
      </div>

      {drawerInitial && (
        <ProfileEditDrawer initialProfile={drawerInitial} />
      )}
    </div>
  );
}
