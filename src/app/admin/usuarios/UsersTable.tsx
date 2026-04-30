"use client";

import { UserActionsKebab } from "./UserActionsKebab";
import type { UserListRow } from "@/lib/queries/users";
import styles from "./UsersTable.module.css";

// ═══════════════════════════════════════════════════════════════
//  UsersTable · backoffice users list
// ═══════════════════════════════════════════════════════════════

const PROFILE_BADGE_CLASS: Record<string, string> = {
  SUPER_ADMIN: "badgeSa",
  MAXTRACKER_ADMIN: "badgeMa",
  CLIENT_ADMIN: "badgeCa",
  OPERATOR: "badgeOp",
};

const PROFILE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  MAXTRACKER_ADMIN: "Admin Maxtracker",
  CLIENT_ADMIN: "Admin de cliente",
  OPERATOR: "Operador",
};

interface Props {
  rows: UserListRow[];
  /** ID del usuario actual · usado para deshabilitar acciones sobre uno mismo */
  currentUserId: string;
  /** Si tiene canWrite, mostrar kebab en cada fila */
  canWrite: boolean;
}

export function UsersTable({ rows, currentUserId, canWrite }: Props) {
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        No hay usuarios que cumplan los filtros.
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Usuario</th>
            <th className={styles.th}>Cliente</th>
            <th className={styles.th}>Perfil</th>
            <th className={styles.th}>Estado</th>
            {canWrite && (
              <th className={styles.thAction} aria-hidden="true" />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const fullName = `${u.firstName} ${u.lastName}`;
            const initials = `${u.firstName[0] ?? "?"}${u.lastName[0] ?? ""}`.toUpperCase();
            const isSelf = u.id === currentUserId;
            const badgeClass = PROFILE_BADGE_CLASS[u.profileSystemKey] ?? "";
            const profileLabel =
              PROFILE_LABEL[u.profileSystemKey] ?? u.profileLabel;

            return (
              <tr
                key={u.id}
                className={`${styles.row} ${u.status === "SUSPENDED" ? styles.rowSuspended : ""}`}
              >
                <td className={styles.td}>
                  <div className={styles.userCell}>
                    <span
                      className={styles.avatar}
                      style={{
                        background: avatarColorFromId(u.id),
                      }}
                    >
                      {initials}
                    </span>
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>
                        {fullName}
                        {isSelf && <span className={styles.selfTag}>(vos)</span>}
                      </span>
                      <span className={styles.userEmail}>{u.email}</span>
                    </div>
                  </div>
                </td>
                <td className={styles.td}>
                  {u.accountName ? (
                    <span className={styles.dim}>{u.accountName}</span>
                  ) : (
                    <span className={styles.placeholder}>—</span>
                  )}
                </td>
                <td className={styles.td}>
                  <span
                    className={`${styles.badge} ${styles[badgeClass] ?? ""}`}
                  >
                    {profileLabel}
                  </span>
                </td>
                <td className={styles.td}>
                  {u.status === "ACTIVE" ? (
                    <span className={`${styles.statusPill} ${styles.statusActive}`}>
                      Activo
                    </span>
                  ) : (
                    <span className={`${styles.statusPill} ${styles.statusSuspended}`}>
                      Suspendido
                    </span>
                  )}
                </td>
                {canWrite && (
                  <td className={`${styles.td} ${styles.tdAction}`}>
                    <UserActionsKebab
                      userId={u.id}
                      userEmail={u.email}
                      fullName={fullName}
                      status={u.status}
                      isSelf={isSelf}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helper · color de avatar derivado del id (estable)
//  ─────────────────────────────────────────────────────────────
//  Mismo patrón que el Topbar de F1 · paleta de 8 colores
// ═══════════════════════════════════════════════════════════════

const AVATAR_COLORS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#06B6D4", "#EF4444", "#6366F1",
];

function avatarColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
