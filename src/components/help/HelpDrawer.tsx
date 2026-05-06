"use client";

import { useEffect, useState } from "react";
import { X, FileText, AlertCircle, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./HelpDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  HelpDrawer · S6-WIKI
//  ─────────────────────────────────────────────────────────────
//  Side panel desde la derecha · muestra la documentación de la
//  vista actual via /api/public/wiki/{slug}.
//
//  Estados:
//    · loading · spinner mientras llega la respuesta
//    · empty   · 404 · "Documentación no disponible"
//    · error   · 4xx/5xx · "No se pudo cargar la doc"
//    · loaded  · render con react-markdown + remark-gfm
//
//  Cierra con:
//    · Click en backdrop
//    · Tecla Esc
//    · Botón × en el header
//
//  Lock body scroll cuando está abierto.
// ═══════════════════════════════════════════════════════════════

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; content: string }
  | { kind: "empty" }
  | { kind: "error"; message: string };

interface Props {
  open: boolean;
  slug: string;
  onClose: () => void;
}

export function HelpDrawer({ open, slug, onClose }: Props) {
  const [state, setState] = useState<FetchState>({ kind: "idle" });

  // Cargar wiki cuando se abre
  useEffect(() => {
    if (!open) return;
    if (!slug) return;

    let cancelled = false;
    setState({ kind: "loading" });

    fetch(`/api/public/wiki/${slug}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) {
          setState({ kind: "empty" });
          return;
        }
        if (!r.ok) {
          setState({
            kind: "error",
            message: `Error ${r.status}`,
          });
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        if (!data.content) {
          setState({ kind: "empty" });
          return;
        }
        setState({ kind: "loaded", content: data.content });
      })
      .catch((e: any) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e?.message ?? "Network error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, slug]);

  // Lock body scroll · Esc handler
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Ayuda de la pantalla">
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <FileText size={14} />
            <span className={styles.kicker}>Documentación</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>

        <div className={styles.body}>
          {state.kind === "loading" && (
            <div className={styles.statusBlock}>
              <Loader2 size={18} className={styles.spin} />
              <span>Cargando documentación…</span>
            </div>
          )}

          {state.kind === "empty" && (
            <div className={styles.statusBlock}>
              <FileText size={18} />
              <div>
                <strong>Documentación no disponible</strong>
                <p>
                  Aún no hay contenido escrito para esta pantalla. Si querés
                  contribuir, agregá un archivo <code>.mdx</code> en{" "}
                  <code>docs/wiki/{slug}.mdx</code>.
                </p>
              </div>
            </div>
          )}

          {state.kind === "error" && (
            <div className={styles.statusBlock}>
              <AlertCircle size={18} />
              <div>
                <strong>No se pudo cargar la documentación</strong>
                <p>{state.message}</p>
              </div>
            </div>
          )}

          {state.kind === "loaded" && (
            <div className={styles.markdown}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Targets _blank para links externos
                  a: ({ href, children, ...props }) => {
                    const isExternal = href?.startsWith("http");
                    return (
                      <a
                        href={href}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {state.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <span className={styles.footerSlug}>{slug}.mdx</span>
        </footer>
      </aside>
    </>
  );
}
