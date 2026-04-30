"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Pencil,
  Pause,
  Play,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";
import { reactivateUser, resetUserPassword, suspendUser } from "./actions";
import styles from "./UserActionsKebab.module.css";

// ═══════════════════════════════════════════════════════════════
//  UserActionsKebab · acciones por usuario
//  ─────────────────────────────────────────────────────────────
//  Editar · abre drawer
//  Suspender / Reactivar · toggle de status
//  Resetear contraseña · vuelve a "demo123" + muestra credenciales
// ═══════════════════════════════════════════════════════════════

interface Props {
  userId: string;
  userEmail: string;
  fullName: string;
  status: "ACTIVE" | "SUSPENDED";
  isSelf: boolean;
}

export function UserActionsKebab({
  userId,
  userEmail,
  fullName,
  status,
  isSelf,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingSuspend, setConfirmingSuspend] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      !open &&
      !confirmingSuspend &&
      !confirmingReset &&
      !resetResult &&
      !errorMsg
    )
      return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingSuspend(false);
        setConfirmingReset(false);
        setResetResult(null);
        setErrorMsg(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmingSuspend(false);
        setConfirmingReset(false);
        setResetResult(null);
        setErrorMsg(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, confirmingSuspend, confirmingReset, resetResult, errorMsg]);

  function handleEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    router.push(`/admin/usuarios?edit=${userId}`, { scroll: false });
  }

  function handleConfirmSuspend(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await suspendUser(userId);
      if (result.ok) {
        setConfirmingSuspend(false);
        router.refresh();
      } else {
        setConfirmingSuspend(false);
        setErrorMsg(result.message ?? "Error");
      }
    });
  }

  function handleReactivate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    startTransition(async () => {
      const result = await reactivateUser(userId);
      if (result.ok) {
        router.refresh();
      } else {
        setErrorMsg(result.message ?? "Error");
      }
    });
  }

  function handleConfirmReset(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await resetUserPassword(userId);
      if (result.ok && result.initialPassword) {
        setConfirmingReset(false);
        setResetResult(result.initialPassword);
        router.refresh();
      } else {
        setConfirmingReset(false);
        setErrorMsg(result.message ?? "Error");
      }
    });
  }

  async function handleCopy() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${userEmail}\nContraseña: ${resetResult}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmingSuspend(false);
    setConfirmingReset(false);
    setResetResult(null);
    setErrorMsg(null);
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.btn}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Acciones"
        aria-expanded={open}
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            className={styles.menuItem}
            onClick={handleEdit}
            role="menuitem"
          >
            <Pencil size={13} />
            <span>Editar datos</span>
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setConfirmingReset(true);
            }}
            role="menuitem"
            disabled={isSelf}
          >
            <KeyRound size={13} />
            <span>Resetear contraseña</span>
          </button>
          {status === "ACTIVE" ? (
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuItemWarn}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setConfirmingSuspend(true);
              }}
              role="menuitem"
              disabled={isSelf}
            >
              <Pause size={13} />
              <span>Suspender</span>
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuItemOk}`}
              onClick={handleReactivate}
              role="menuitem"
              disabled={isSelf}
            >
              <Play size={13} />
              <span>Reactivar</span>
            </button>
          )}
        </div>
      )}

      {confirmingSuspend && (
        <div className={styles.confirmPopover} role="dialog">
          <div className={styles.confirmHeader}>
            ¿Suspender a <strong>{fullName}</strong>?
          </div>
          <div className={styles.confirmHint}>
            El usuario no va a poder iniciar sesión hasta que lo reactives.
            Sus datos se conservan intactos.
          </div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.confirmBtn} ${styles.confirmBtnWarn}`}
              onClick={handleConfirmSuspend}
              disabled={isPending}
            >
              {isPending ? "Procesando…" : "Suspender"}
            </button>
          </div>
        </div>
      )}

      {confirmingReset && (
        <div className={styles.confirmPopover} role="dialog">
          <div className={styles.confirmHeader}>
            ¿Resetear contraseña de <strong>{fullName}</strong>?
          </div>
          <div className={styles.confirmHint}>
            Vamos a generar una contraseña inicial nueva (<code>demo123</code>)
            que vas a poder copiar y compartir.
          </div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleConfirmReset}
              disabled={isPending}
            >
              {isPending ? "Procesando…" : "Resetear"}
            </button>
          </div>
        </div>
      )}

      {resetResult && (
        <div className={styles.confirmPopover} role="dialog">
          <div className={styles.confirmHeader}>Contraseña reseteada</div>
          <div className={styles.credBox}>
            <div className={styles.credRow}>
              <span className={styles.credLabel}>Email</span>
              <span className={styles.credValue}>{userEmail}</span>
            </div>
            <div className={styles.credRow}>
              <span className={styles.credLabel}>Contraseña</span>
              <span className={`${styles.credValue} ${styles.mono}`}>
                {resetResult}
              </span>
            </div>
          </div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check size={13} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={13} /> Copiar
                </>
              )}
            </button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleCancel}
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className={styles.errorPopover} role="alertdialog">
          <div className={styles.errorMsg}>{errorMsg}</div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
