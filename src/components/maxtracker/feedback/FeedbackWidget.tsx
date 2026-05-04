"use client";

import { useState, useCallback, useEffect } from "react";
import { MessageSquare, X, Check, AlertCircle } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./FeedbackWidget.module.css";

// ═══════════════════════════════════════════════════════════════
//  FeedbackWidget · S1-L8 feedback-widget
//  ─────────────────────────────────────────────────────────────
//  Botón flotante bottom-right + modal con form de feedback.
//  Siempre visible en /(product)/* para usuarios autenticados.
//
//  Captura automática de contexto:
//    · pageUrl · de usePathname() + searchParams
//    · userAgent · de navigator.userAgent
//    · viewport · de window.innerWidth × innerHeight
//
//  El user solo escribe el mensaje y elige categoría · resto es
//  metadata invisible que ayuda a triage.
//
//  States:
//    closed → opening → open → submitting → success → closing
//    closed → opening → open → submitting → error → open (retry)
// ═══════════════════════════════════════════════════════════════

type WidgetState =
  | "closed"
  | "open"
  | "submitting"
  | "success"
  | "error";

type Category = "BUG" | "FEATURE" | "OTHER";

const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: "BUG", label: "Bug", hint: "Algo no funciona como esperaba" },
  { key: "FEATURE", label: "Idea", hint: "Sugerencia de mejora o feature" },
  { key: "OTHER", label: "Otro", hint: "Pregunta o comentario general" },
];

export function FeedbackWidget() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<WidgetState>("closed");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("OTHER");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const open = useCallback(() => {
    setState("open");
    setErrorMsg(null);
  }, []);

  const close = useCallback(() => {
    setState("closed");
    // Pequeño delay antes de limpiar para que la animación tenga tiempo
    setTimeout(() => {
      setMessage("");
      setCategory("OTHER");
      setErrorMsg(null);
    }, 200);
  }, []);

  // Cerrar con ESC
  useEffect(() => {
    if (state !== "open" && state !== "error") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, close]);

  const submit = useCallback(async () => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setErrorMsg("Escribí un mensaje antes de enviar");
      return;
    }

    setState("submitting");
    setErrorMsg(null);

    try {
      const queryString = searchParams?.toString() ?? "";
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          category,
          pageUrl: fullPath,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "",
          viewport:
            typeof window !== "undefined"
              ? `${window.innerWidth}x${window.innerHeight}`
              : null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setState("success");
      // Cerrar automáticamente después de 1.5s con success
      setTimeout(() => {
        close();
      }, 1800);
    } catch (err) {
      setState("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "No pudimos enviar tu feedback. Probá de nuevo.",
      );
    }
  }, [message, category, pathname, searchParams, close]);

  // ── Estado closed · solo botón flotante ──────────────────
  if (state === "closed") {
    return (
      <button
        type="button"
        className={styles.fab}
        onClick={open}
        aria-label="Enviar feedback"
        title="Enviar feedback"
      >
        <MessageSquare size={16} />
        <span className={styles.fabLabel}>Feedback</span>
      </button>
    );
  }

  // ── Estado open / submitting / success / error · panel ───
  return (
    <>
      {/* FAB sigue visible · cierre al click fuera */}
      <button
        type="button"
        className={styles.fab}
        onClick={close}
        aria-label="Cerrar feedback"
        title="Cerrar"
      >
        <X size={16} />
        <span className={styles.fabLabel}>Cerrar</span>
      </button>

      <div
        className={styles.backdrop}
        onClick={close}
        role="presentation"
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Enviar feedback"
      >
        <header className={styles.head}>
          <h3 className={styles.title}>Tu feedback</h3>
          <p className={styles.subtitle}>
            Bug, idea o pregunta · llega directo al equipo de Maxtracker.
          </p>
        </header>

        {state === "success" ? (
          <div className={styles.success}>
            <Check size={28} className={styles.successIcon} />
            <h4 className={styles.successTitle}>¡Gracias!</h4>
            <p className={styles.successMsg}>
              Tu feedback fue enviado · lo vamos a revisar pronto.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.body}>
              {/* Categoría · 3 botones */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Categoría</label>
                <div className={styles.categoryRow}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      className={`${styles.categoryBtn} ${
                        category === cat.key ? styles.categoryActive : ""
                      }`}
                      onClick={() => setCategory(cat.key)}
                      title={cat.hint}
                      disabled={state === "submitting"}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <span className={styles.categoryHint}>
                  {CATEGORIES.find((c) => c.key === category)?.hint}
                </span>
              </div>

              {/* Mensaje */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="fb-msg">
                  Mensaje
                </label>
                <textarea
                  id="fb-msg"
                  className={styles.textarea}
                  rows={5}
                  maxLength={5000}
                  placeholder="Contame lo que pasó, qué esperabas o tu idea…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={state === "submitting"}
                  autoFocus
                />
                <div className={styles.charCount}>
                  {message.length} / 5000
                </div>
              </div>

              {/* Error inline */}
              {errorMsg && (
                <div className={styles.errorBox}>
                  <AlertCircle size={13} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Hint sobre contexto auto-capturado */}
              <p className={styles.contextHint}>
                Adjuntamos automáticamente la URL en la que estás, el
                navegador y el tamaño de pantalla para ayudarnos a entender
                el contexto.
              </p>
            </div>

            <footer className={styles.footer}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={close}
                disabled={state === "submitting"}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={submit}
                disabled={state === "submitting" || message.trim().length === 0}
              >
                {state === "submitting" ? "Enviando…" : "Enviar"}
              </button>
            </footer>
          </>
        )}
      </div>
    </>
  );
}
