"use client";

import { useState, useTransition } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { SessionData } from "@/lib/session";
import { changePassword } from "./actions";
import sharedStyles from "./ConfiguracionPage.module.css";
import styles from "./SeguridadTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab "Seguridad" · cambiar contraseña + sesiones activas
//  ─────────────────────────────────────────────────────────────
//  Validación · 8+ chars con letras y números en nueva · repetir
//  = nueva. La actual SE valida contra Supabase Auth via signIn ·
//  si está mal, devuelve "Contraseña actual incorrecta".
//
//  Las sesiones activas son mock · no hay tabla de sesiones todavía.
//  El botón "Cerrar" muestra un mensaje pero no hace nada real.
//  TODO post-MVP: integrar con Supabase Auth para listar sesiones
//  reales (endpoint admin · necesita SERVICE_ROLE_KEY).
// ═══════════════════════════════════════════════════════════════

interface Props {
  session: SessionData;
}

interface MockSession {
  id: string;
  device: "desktop" | "mobile";
  deviceLabel: string;
  location: string;
  lastSeen: string;
  isCurrent: boolean;
}

const MOCK_SESSIONS: MockSession[] = [
  {
    id: "current",
    device: "desktop",
    deviceLabel: "Mac · Safari 18",
    location: "Buenos Aires, AR",
    lastSeen: "Activa ahora",
    isCurrent: true,
  },
  {
    id: "iphone",
    device: "mobile",
    deviceLabel: "iPhone · iOS 18.4",
    location: "Buenos Aires, AR",
    lastSeen: "Hace 3 horas",
    isCurrent: false,
  },
];

export function SeguridadTab({ session }: Props) {
  const [isPending, startTransition] = useTransition();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const [revokeMsg, setRevokeMsg] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await changePassword({ current, next, repeat });
      if (result.ok) {
        setSuccessMsg(result.message ?? "Contraseña actualizada");
        setCurrent("");
        setNext("");
        setRepeat("");
      } else if (result.errors) {
        setErrors(result.errors);
      }
    });
  }

  function revokeSession(id: string) {
    setRevokedIds((prev) => new Set(prev).add(id));
    setRevokeMsg("Sesión cerrada");
    setTimeout(() => setRevokeMsg(null), 3000);
  }

  const visibleSessions = MOCK_SESSIONS.filter(
    (s) => !revokedIds.has(s.id),
  );

  return (
    <div className={styles.container}>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Seguridad</h2>
        <p className={sharedStyles.tabSubtitle}>
          Cambiá tu contraseña y revisá tus sesiones activas.
        </p>
      </header>

      {/* ── Cambiar contraseña ──────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Cambiar contraseña</h3>
        <p className={styles.sectionHint}>
          Mínimo 8 caracteres con letras y números.
        </p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <Field label="Contraseña actual" error={errors.current} required>
            <input
              type="password"
              className={styles.input}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={isPending}
              autoComplete="current-password"
            />
          </Field>

          <Field label="Nueva contraseña" error={errors.next} required>
            <input
              type="password"
              className={styles.input}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              disabled={isPending}
              autoComplete="new-password"
            />
          </Field>

          <Field label="Repetir nueva contraseña" error={errors.repeat} required>
            <input
              type="password"
              className={styles.input}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              disabled={isPending}
              autoComplete="new-password"
            />
          </Field>

          <div className={styles.formFooter}>
            {successMsg && (
              <span className={styles.successMsg}>{successMsg}</span>
            )}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isPending || !current || !next || !repeat}
            >
              {isPending ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Sesiones activas ──────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sessionsHeader}>
          <h3 className={styles.sectionTitle}>Sesiones activas</h3>
          {revokeMsg && (
            <span className={styles.successMsg}>{revokeMsg}</span>
          )}
        </div>
        <p className={styles.sectionHint}>
          Dispositivos donde está abierta tu cuenta · podés cerrar las que
          no reconozcas.
        </p>

        {visibleSessions.length === 0 ? (
          <div className={styles.emptyMsg}>
            Solo tu sesión actual está abierta.
          </div>
        ) : (
          <ul className={styles.sessionList}>
            {visibleSessions.map((s) => (
              <li key={s.id} className={styles.sessionItem}>
                <span className={styles.sessionIcon}>
                  {s.device === "desktop" ? (
                    <Monitor size={18} />
                  ) : (
                    <Smartphone size={18} />
                  )}
                </span>
                <div className={styles.sessionInfo}>
                  <span className={styles.sessionDevice}>
                    {s.deviceLabel}
                    {s.isCurrent && (
                      <span className={styles.sessionCurrent}>actual</span>
                    )}
                  </span>
                  <span className={styles.sessionMeta}>
                    {s.location}
                    <span className={styles.sessionSep}> · </span>
                    {s.lastSeen}
                  </span>
                </div>
                {!s.isCurrent && (
                  <button
                    type="button"
                    className={styles.revokeBtn}
                    onClick={() => revokeSession(s.id)}
                  >
                    Cerrar sesión
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Field · label + input + error
// ═══════════════════════════════════════════════════════════════

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.fieldRequired}> *</span>}
      </label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}
