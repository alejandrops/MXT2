"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { switchIdentity } from "@/lib/actions/session-actions";
import styles from "./LoginPicker.module.css";

// ═══════════════════════════════════════════════════════════════
//  LoginPicker · L7-DEMO · selector de identidad para testing
//  ─────────────────────────────────────────────────────────────
//  Render del modo AUTH_MODE=demo · permite logear como cualquier
//  user seedeado sin password. Solo para desarrollo / pruebas.
//
//  Agrupado por account · primero "Maxtracker" (interno) y
//  después cada cliente (Transportes, Minera, Rappi). Cada user
//  muestra su rol como badge.
//
//  Se reutiliza `switchIdentity()` (server action) que ya setea
//  la cookie `mxt-demo-user-id` y revalida el árbol completo.
// ═══════════════════════════════════════════════════════════════

export interface PickerUser {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  avatarColor: string;
  roleLabel: string;
  roleKey: "SUPER_ADMIN" | "MAXTRACKER_ADMIN" | "CLIENT_ADMIN" | "OPERATOR";
}

export interface PickerGroup {
  /** Nombre del grupo (account name o "Maxtracker") */
  label: string;
  /** Subtítulo opcional · ej. tier "PRO" o "Interno" */
  caption?: string;
  /** True si es el equipo Maxtracker · cambia el accent visual */
  isInternal?: boolean;
  users: PickerUser[];
}

interface Props {
  groups: PickerGroup[];
}

export function LoginPicker({ groups }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handlePick(userId: string) {
    if (isPending) return;
    setSelectedId(userId);
    startTransition(async () => {
      try {
        await switchIdentity(userId);
        router.push("/");
        router.refresh();
      } catch (err) {
        console.error("[LoginPicker] switchIdentity failed", err);
        setSelectedId(null);
      }
    });
  }

  return (
    <div className={styles.picker}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Modo demo · seleccioná un usuario</h2>
        <p className={styles.hint}>
          Sesión sin password · solo para desarrollo y pruebas. Podés cambiar
          de usuario en cualquier momento desde el avatar arriba a la
          derecha.
        </p>
      </div>

      {groups.map((group) => (
        <div
          key={group.label}
          className={`${styles.group} ${group.isInternal ? styles.groupInternal : ""}`}
        >
          <div className={styles.groupHeader}>
            <span className={styles.groupLabel}>{group.label}</span>
            {group.caption && (
              <span className={styles.groupCaption}>{group.caption}</span>
            )}
          </div>

          <div className={styles.userList}>
            {group.users.map((user) => {
              const isSelected = selectedId === user.id;
              const isLoading = isPending && isSelected;
              return (
                <button
                  key={user.id}
                  type="button"
                  className={styles.userRow}
                  onClick={() => handlePick(user.id)}
                  disabled={isPending}
                  aria-busy={isLoading}
                >
                  <span
                    className={styles.avatar}
                    style={{ background: user.avatarColor }}
                    aria-hidden="true"
                  >
                    {user.initials}
                  </span>
                  <span className={styles.userInfo}>
                    <span className={styles.userName}>{user.fullName}</span>
                    <span className={styles.userEmail}>{user.email}</span>
                  </span>
                  <span
                    className={`${styles.roleBadge} ${styles[`role_${user.roleKey}`]}`}
                  >
                    {user.roleLabel}
                  </span>
                  {isLoading && (
                    <Loader2
                      size={14}
                      className={styles.spinner}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
