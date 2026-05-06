"use client";

import { useState, useTransition } from "react";
import {
  KeyRound,
  Pause,
  Play,
  Trash2,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  EntityDetailPanel,
  PanelDataSection,
  PanelActionsSection,
  type DataRow,
} from "@/components/maxtracker/EntityDetailPanel";
import {
  updateAccountUser,
  toggleUserStatus,
  deleteAccountUser,
} from "@/app/(product)/configuracion/actions-empresa";
import styles from "./UserDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  UserDetailPanel · S5-T1b
//  ─────────────────────────────────────────────────────────────
//  Side panel canónico para la sábana de usuarios de empresa.
//  Reemplaza el modo edit inline + acciones inline del UserRow
//  legacy. Conserva el comportamiento (cambiar perfil · password ·
//  suspender · eliminar) pero en un layout consistente con el
//  resto de side panels (alarmas · viajes · eventos).
// ═══════════════════════════════════════════════════════════════

interface AccountUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  profileId: string;
  profile: {
    id: string;
    systemKey: string;
    nameLabel: string;
  };
}

interface AssignableProfile {
  id: string;
  systemKey: string;
  nameLabel: string;
}

interface Props {
  user: AccountUser | null;
  isCurrentUser: boolean;
  assignableProfiles: AssignableProfile[];
  onClose: () => void;
  onChange: () => void;
  onFeedback: (kind: "success" | "error", text: string) => void;
  onSetPass: () => void;
}

export function UserDetailPanel({
  user,
  isCurrentUser,
  assignableProfiles,
  onClose,
  onChange,
  onFeedback,
  onSetPass,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileIdDraft, setProfileIdDraft] = useState<string>(
    user?.profileId ?? "",
  );

  if (!user) {
    return (
      <EntityDetailPanel open={false} onClose={onClose} title="">
        <div />
      </EntityDetailPanel>
    );
  }

  const isActive = user.status === "ACTIVE";
  const statusLabel =
    user.status === "ACTIVE"
      ? "Activo"
      : user.status === "SUSPENDED"
        ? "Suspendido"
        : user.status;

  function handleProfileChange() {
    if (!user || profileIdDraft === user.profileId) {
      setEditingProfile(false);
      return;
    }
    startTransition(async () => {
      const result = await updateAccountUser({
        userId: user.id,
        profileId: profileIdDraft,
      });
      if (result.ok) {
        onFeedback("success", "Perfil actualizado.");
        setEditingProfile(false);
        onChange();
      } else {
        onFeedback("error", result.error);
        setProfileIdDraft(user.profileId);
      }
    });
  }

  function handleToggleStatus() {
    if (!user) return;
    const newStatus = isActive ? "SUSPENDED" : "ACTIVE";
    if (
      !confirm(
        isActive
          ? `Suspender a ${user.firstName}? No podrá iniciar sesión hasta reactivarlo.`
          : `Reactivar a ${user.firstName}?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await toggleUserStatus({
        userId: user.id,
        newStatus,
      });
      if (result.ok) {
        onFeedback(
          "success",
          isActive ? "Usuario suspendido." : "Usuario reactivado.",
        );
        onChange();
        onClose();
      } else {
        onFeedback("error", result.error);
      }
    });
  }

  function handleDelete() {
    if (!user) return;
    if (
      !confirm(
        `Eliminar a ${user.firstName} ${user.lastName}? Esto es irreversible.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteAccountUser({ userId: user.id });
      if (result.ok) {
        onFeedback("success", "Usuario eliminado.");
        onChange();
        onClose();
      } else {
        onFeedback("error", result.error);
      }
    });
  }

  // ── Build data rows ─────────────────────────────────
  const dataRows: DataRow[] = [
    {
      label: "Nombre",
      value: (
        <span>
          {user.firstName} {user.lastName}
          {isCurrentUser && <span className={styles.youBadge}> · Vos</span>}
        </span>
      ),
    },
    {
      label: "Email",
      value: <span className={styles.email}>{user.email}</span>,
    },
    {
      label: "Perfil",
      value: editingProfile && !isCurrentUser ? (
        <div className={styles.inlineEdit}>
          <select
            value={profileIdDraft}
            onChange={(e) => setProfileIdDraft(e.target.value)}
            className={styles.select}
            disabled={pending}
          >
            {assignableProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameLabel}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleProfileChange}
            className={styles.iconBtn}
            disabled={pending}
            title="Guardar"
          >
            <CheckCircle2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setProfileIdDraft(user.profileId);
              setEditingProfile(false);
            }}
            className={styles.iconBtn}
            disabled={pending}
            title="Cancelar"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !isCurrentUser && setEditingProfile(true)}
          className={styles.profileButton}
          disabled={isCurrentUser}
          title={
            isCurrentUser
              ? "No podés cambiar tu propio perfil"
              : "Click para editar"
          }
        >
          {user.profile.nameLabel}
        </button>
      ),
    },
    {
      label: "Estado",
      value: (
        <span
          className={`${styles.statusBadge} ${
            isActive ? styles.statusActive : styles.statusSuspended
          }`}
        >
          {statusLabel}
        </span>
      ),
    },
  ];

  return (
    <EntityDetailPanel
      open={true}
      onClose={onClose}
      kicker="Usuario"
      title={`${user.firstName} ${user.lastName}`}
      subtitle={user.profile.nameLabel}
    >
      <PanelDataSection title="Detalles" rows={dataRows} />

      {!isCurrentUser && (
        <PanelActionsSection title="Acciones">
          <div className={styles.actionsWrap}>
            <button
              type="button"
              onClick={onSetPass}
              className={styles.actionBtn}
              disabled={pending}
            >
              <KeyRound size={13} />
              <span>Cambiar contraseña</span>
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              className={styles.actionBtn}
              disabled={pending}
            >
              {isActive ? <Pause size={13} /> : <Play size={13} />}
              <span>{isActive ? "Suspender usuario" : "Reactivar usuario"}</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`${styles.actionBtn} ${styles.dangerBtn}`}
              disabled={pending}
            >
              <Trash2 size={13} />
              <span>Eliminar usuario</span>
            </button>
          </div>
        </PanelActionsSection>
      )}

      {isCurrentUser && (
        <div className={styles.terminalNote}>
          Este es tu propio usuario · no podés modificarte a vos mismo desde
          esta pantalla.
        </div>
      )}
    </EntityDetailPanel>
  );
}
