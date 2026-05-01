"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Pause,
  Play,
  X,
  Info,
} from "lucide-react";
import {
  createAccountUser,
  updateAccountUser,
  toggleUserStatus,
  deleteAccountUser,
} from "../actions-empresa";
import sharedStyles from "../ConfiguracionPage.module.css";
import styles from "./EmpresaUsuariosTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab Empresa · Usuarios y permisos (S1)
//  ─────────────────────────────────────────────────────────────
//  CRUD de usuarios del Account. Solo crea User local · NO invita
//  por mail (decisión del producto · invite manual por ahora).
//
//  Acciones:
//   · Crear user (firstName, lastName, email, profile)
//   · Editar perfil (CLIENT_ADMIN ↔ OPERATOR)
//   · Suspender / reactivar (toggle status)
//   · Eliminar (soft delete via status DELETED)
//
//  Reglas:
//   · No te podés borrar a vos mismo
//   · No podés cambiar tu propio perfil (evitar lock-out)
//   · Solo CA puede gestionar otros CA u OP de su cuenta
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
  account: { id: string; name: string };
  users: AccountUser[];
  assignableProfiles: AssignableProfile[];
  currentUserId: string;
}

export function EmpresaUsuariosTab({
  account,
  users,
  assignableProfiles,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  // Auto-clear feedback a los 4s
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  function showFeedback(kind: "success" | "error", text: string) {
    setFeedback({ kind, text });
  }

  return (
    <div>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Usuarios y permisos</h2>
        <p className={sharedStyles.tabSubtitle}>
          Gestioná los usuarios que acceden a {account.name}.
        </p>
      </header>

      {feedback && (
        <div
          className={
            feedback.kind === "success"
              ? sharedStyles.successMessage
              : sharedStyles.errorMessage
          }
          style={{ marginBottom: 16 }}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className={styles.toolbar}>
        <span className={styles.count}>
          {users.length} usuario{users.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          className={sharedStyles.btnPrimary}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} />
          Nuevo usuario
        </button>
      </div>

      <table className={sharedStyles.dataTable}>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Perfil</th>
            <th>Estado</th>
            <th style={{ width: 120, textAlign: "right" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUserId}
              assignableProfiles={assignableProfiles}
              onFeedback={showFeedback}
              onChange={() => router.refresh()}
            />
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--t3)" }}>
                Aún no hay usuarios en esta cuenta.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showCreate && (
        <CreateUserModal
          accountId={account.id}
          assignableProfiles={assignableProfiles}
          onClose={() => setShowCreate(false)}
          onSuccess={(message) => {
            setShowCreate(false);
            showFeedback("success", message);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── User row ────────────────────────────────────────────────

interface UserRowProps {
  user: AccountUser;
  isCurrentUser: boolean;
  assignableProfiles: AssignableProfile[];
  onFeedback: (kind: "success" | "error", text: string) => void;
  onChange: () => void;
}

function UserRow({
  user,
  isCurrentUser,
  assignableProfiles,
  onFeedback,
  onChange,
}: UserRowProps) {
  const [pending, startTransition] = useTransition();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileId, setProfileId] = useState(user.profileId);

  const isActive = user.status === "ACTIVE";
  const statusLabel =
    user.status === "ACTIVE"
      ? "Activo"
      : user.status === "SUSPENDED"
      ? "Suspendido"
      : user.status;

  function handleProfileChange() {
    if (profileId === user.profileId) {
      setEditingProfile(false);
      return;
    }
    startTransition(async () => {
      const result = await updateAccountUser({
        userId: user.id,
        profileId,
      });
      if (result.ok) {
        onFeedback("success", "Perfil actualizado.");
        setEditingProfile(false);
        onChange();
      } else {
        onFeedback("error", result.error);
        setProfileId(user.profileId);
      }
    });
  }

  function handleToggleStatus() {
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
        onFeedback("success", isActive ? "Usuario suspendido." : "Usuario reactivado.");
        onChange();
      } else {
        onFeedback("error", result.error);
      }
    });
  }

  function handleDelete() {
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
      } else {
        onFeedback("error", result.error);
      }
    });
  }

  return (
    <tr>
      <td>
        <strong>{user.firstName} {user.lastName}</strong>
        {isCurrentUser && <span className={styles.youBadge}>Vos</span>}
      </td>
      <td className={styles.emailCell}>{user.email}</td>
      <td>
        {editingProfile && !isCurrentUser ? (
          <div className={styles.inlineEdit}>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className={sharedStyles.select}
              style={{ height: 28, width: 160 }}
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
                setProfileId(user.profileId);
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
            title={isCurrentUser ? "No podés cambiar tu propio perfil" : "Click para editar"}
          >
            {user.profile.nameLabel}
          </button>
        )}
      </td>
      <td>
        <span
          className={`${sharedStyles.statusBadge} ${
            isActive ? sharedStyles.statusBadgeActive : sharedStyles.statusBadgeSuspended
          }`}
        >
          {statusLabel}
        </span>
      </td>
      <td style={{ textAlign: "right" }}>
        <div className={styles.rowActions}>
          {!isCurrentUser && (
            <>
              <button
                type="button"
                onClick={handleToggleStatus}
                className={styles.iconBtn}
                disabled={pending}
                title={isActive ? "Suspender" : "Reactivar"}
              >
                {isActive ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className={`${styles.iconBtn} ${styles.dangerBtn}`}
                disabled={pending}
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Create user modal ───────────────────────────────────────

interface CreateUserModalProps {
  accountId: string;
  assignableProfiles: AssignableProfile[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function CreateUserModal({
  accountId,
  assignableProfiles,
  onClose,
  onSuccess,
}: CreateUserModalProps) {
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profileId, setProfileId] = useState(
    assignableProfiles.find((p) => p.systemKey === "OPERATOR")?.id ??
      assignableProfiles[0]?.id ??
      "",
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createAccountUser({
        accountId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        profileId,
      });

      if (result.ok) {
        onSuccess(`Usuario ${firstName} ${lastName} creado.`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Nuevo usuario</h3>
          <button
            type="button"
            onClick={onClose}
            className={styles.modalClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={sharedStyles.fieldRow}>
            <div className={sharedStyles.field}>
              <label className={sharedStyles.label}>Nombre</label>
              <input
                type="text"
                required
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={sharedStyles.input}
                disabled={pending}
              />
            </div>
            <div className={sharedStyles.field}>
              <label className={sharedStyles.label}>Apellido</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={sharedStyles.input}
                disabled={pending}
              />
            </div>
          </div>

          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={sharedStyles.input}
              placeholder="usuario@empresa.com"
              disabled={pending}
            />
          </div>

          <div className={styles.infoBox}>
            <Info size={14} />
            <div>
              <strong>Importante · invite manual</strong>
              <p>
                Este formulario solo crea el usuario en la base de datos. Para
                que pueda iniciar sesión, también hay que crearle la cuenta en
                Supabase Auth con el mismo email. Tu administrador de Maxtracker
                (Alejandro) lo gestiona.
              </p>
            </div>
          </div>

          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Perfil</label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className={sharedStyles.select}
              disabled={pending}
            >
              {assignableProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameLabel}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className={sharedStyles.errorMessage}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={sharedStyles.btnSecondary}
              disabled={pending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={sharedStyles.btnPrimary}
              disabled={pending || !firstName || !lastName || !email}
            >
              {pending && <Loader2 size={14} className={sharedStyles.spin} />}
              Crear usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
