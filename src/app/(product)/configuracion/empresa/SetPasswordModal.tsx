"use client";

import { useState, useTransition, useEffect } from "react";
import { X, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { setUserPassword } from "../actions-empresa";
import sharedStyles from "../ConfiguracionPage.module.css";
import styles from "./SetPasswordModal.module.css";

// ═══════════════════════════════════════════════════════════════
//  SetPasswordModal · admin set password de otro user
//  ─────────────────────────────────────────────────────────────
//  Uso · CA o SA/MA pueden cambiar la pass de cualquier user de
//  su cuenta sin saber la password actual. Útil cuando un user
//  olvidó la suya y no hay reset por email todavía.
//
//  La nueva password queda lista en Supabase Auth · admin tiene
//  que comunicársela al user por su canal (Slack, WhatsApp, etc.)
// ═══════════════════════════════════════════════════════════════

interface Props {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function SetPasswordModal({ user, onClose, onSuccess }: Props) {
  const [pending, startTransition] = useTransition();
  const [newPass, setNewPass] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPass !== repeat) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    startTransition(async () => {
      const result = await setUserPassword({
        userId: user.id,
        newPassword: newPass,
      });

      if (result.ok) {
        onSuccess(
          `Contraseña actualizada para ${user.firstName}. Comunicásela por tu canal habitual.`,
        );
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <KeyRound size={16} />
            <h3 className={styles.title}>Cambiar contraseña</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.userInfo}>
          <div className={styles.userInfoLabel}>Usuario</div>
          <div className={styles.userInfoName}>
            {user.firstName} {user.lastName}
          </div>
          <div className={styles.userInfoEmail}>{user.email}</div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Nueva contraseña</label>
            <div className={styles.passWrap}>
              <input
                type={showPass ? "text" : "password"}
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className={sharedStyles.input}
                placeholder="8+ caracteres con letras y números"
                disabled={pending}
                autoFocus
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className={styles.toggleVisBtn}
                aria-label={showPass ? "Ocultar" : "Mostrar"}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Repetir contraseña</label>
            <input
              type={showPass ? "text" : "password"}
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className={sharedStyles.input}
              disabled={pending}
              minLength={8}
            />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <div className={styles.warning}>
            <strong>⚠ Importante</strong>
            <p>
              Esta acción cambia la contraseña inmediatamente. El usuario será
              desconectado de cualquier sesión activa. Comunicale la nueva
              contraseña por un canal seguro (Slack, WhatsApp, etc.).
            </p>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={sharedStyles.btnSecondary}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending || !newPass || !repeat}
              className={sharedStyles.btnPrimary}
            >
              {pending ? (
                <>
                  <Loader2 size={14} className={styles.spinner} />
                  Aplicando...
                </>
              ) : (
                "Cambiar contraseña"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
