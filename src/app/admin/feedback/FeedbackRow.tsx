"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  X as XIcon,
  RotateCcw,
  Save,
  ExternalLink,
} from "lucide-react";
import { markStatus, saveNotes } from "./actions";
import styles from "./FeedbackRow.module.css";

// ═══════════════════════════════════════════════════════════════
//  FeedbackRow · S2-L6
//  ─────────────────────────────────────────────────────────────
//  Fila colapsable con un feedback. Click en el header abre el
//  detalle · contexto + notas + acciones de status.
//
//  Acciones disponibles según status actual:
//    NEW       → [Marcar revisado] [Cerrar]
//    REVIEWED  → [Cerrar] [Volver a NEW]
//    CLOSED    → [Reabrir]
// ═══════════════════════════════════════════════════════════════

type Status = "NEW" | "REVIEWED" | "CLOSED";
type Category = "BUG" | "FEATURE" | "OTHER";

interface FeedbackData {
  id: string;
  category: Category;
  message: string;
  pageUrl: string;
  userAgent: string;
  viewport: string | null;
  status: Status;
  createdAt: string;
  reviewedAt: string | null;
  adminNotes: string | null;
  user: {
    name: string;
    email: string;
    profileLabel: string;
  } | null;
}

const CATEGORY_LABEL: Record<Category, string> = {
  BUG: "🐛 Bug",
  FEATURE: "💡 Idea",
  OTHER: "💬 Otro",
};

const CATEGORY_COLOR: Record<Category, string> = {
  BUG: styles.catBug!,
  FEATURE: styles.catFeature!,
  OTHER: styles.catOther!,
};

const STATUS_BADGE: Record<Status, string> = {
  NEW: styles.badgeNew!,
  REVIEWED: styles.badgeReviewed!,
  CLOSED: styles.badgeClosed!,
};

const STATUS_LABEL: Record<Status, string> = {
  NEW: "Nuevo",
  REVIEWED: "Revisado",
  CLOSED: "Cerrado",
};

interface Props {
  feedback: FeedbackData;
}

export function FeedbackRow({ feedback }: Props) {
  const [open, setOpen] = useState(feedback.status === "NEW");
  const [notes, setNotes] = useState(feedback.adminNotes ?? "");
  const [pending, startTransition] = useTransition();
  const [savedHint, setSavedHint] = useState<string | null>(null);

  function handleStatus(next: Status) {
    startTransition(async () => {
      try {
        await markStatus(feedback.id, next);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      try {
        await saveNotes(feedback.id, notes);
        setSavedHint("Guardado");
        setTimeout(() => setSavedHint(null), 1500);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error");
      }
    });
  }

  const dateAR = formatDateAR(new Date(feedback.createdAt));

  return (
    <article className={styles.row}>
      {/* Header · siempre visible · click toggle */}
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.chevron}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <span className={`${styles.cat} ${CATEGORY_COLOR[feedback.category]}`}>
          {CATEGORY_LABEL[feedback.category]}
        </span>

        <span className={styles.headerMessage}>
          {truncate(feedback.message, 80)}
        </span>

        <span className={styles.headerMeta}>
          <span className={styles.headerUser}>
            {feedback.user?.name ?? "Anónimo"}
          </span>
          <span className={styles.headerDate}>{dateAR}</span>
          <span className={`${styles.statusBadge} ${STATUS_BADGE[feedback.status]}`}>
            {STATUS_LABEL[feedback.status]}
          </span>
        </span>
      </button>

      {/* Body · solo si abierto */}
      {open && (
        <div className={styles.body}>
          {/* Mensaje completo */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Mensaje</div>
            <p className={styles.message}>{feedback.message}</p>
          </section>

          {/* Contexto · 2 columnas */}
          <section className={styles.contextGrid}>
            <div>
              <div className={styles.sectionLabel}>Usuario</div>
              {feedback.user ? (
                <div className={styles.contextValue}>
                  <div>{feedback.user.name}</div>
                  <div className={styles.contextSub}>
                    {feedback.user.email}
                  </div>
                  <div className={styles.contextSub}>
                    {feedback.user.profileLabel}
                  </div>
                </div>
              ) : (
                <div className={styles.contextValue}>Anónimo</div>
              )}
            </div>

            <div>
              <div className={styles.sectionLabel}>Página</div>
              <div className={styles.contextValue}>
                <a
                  href={feedback.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkValue}
                >
                  <code>{feedback.pageUrl}</code>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div>
              <div className={styles.sectionLabel}>Dispositivo</div>
              <div className={styles.contextValue}>
                <div>{detectDevice(feedback.userAgent)}</div>
                {feedback.viewport && (
                  <div className={styles.contextSub}>
                    Viewport · {feedback.viewport}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className={styles.sectionLabel}>Fechas</div>
              <div className={styles.contextValue}>
                <div>Recibido · {dateAR}</div>
                {feedback.reviewedAt && (
                  <div className={styles.contextSub}>
                    Revisado · {formatDateAR(new Date(feedback.reviewedAt))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Notas internas */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>
              Notas internas
              {savedHint && (
                <span className={styles.savedHint}>· {savedHint}</span>
              )}
            </div>
            <textarea
              className={styles.notesInput}
              rows={2}
              placeholder="Agregá una nota · solo visible para admins"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSaveNotes}
              disabled={pending || notes === (feedback.adminNotes ?? "")}
            >
              <Save size={11} />
              {pending ? "Guardando…" : "Guardar nota"}
            </button>
          </section>

          {/* Acciones · transiciones de status */}
          <section className={styles.actions}>
            {feedback.status === "NEW" && (
              <>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionPrimary}`}
                  onClick={() => handleStatus("REVIEWED")}
                  disabled={pending}
                >
                  <Check size={12} /> Marcar revisado
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => handleStatus("CLOSED")}
                  disabled={pending}
                >
                  <XIcon size={12} /> Cerrar
                </button>
              </>
            )}
            {feedback.status === "REVIEWED" && (
              <>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionPrimary}`}
                  onClick={() => handleStatus("CLOSED")}
                  disabled={pending}
                >
                  <Check size={12} /> Cerrar
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => handleStatus("NEW")}
                  disabled={pending}
                >
                  <RotateCcw size={12} /> Volver a Nuevo
                </button>
              </>
            )}
            {feedback.status === "CLOSED" && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => handleStatus("NEW")}
                disabled={pending}
              >
                <RotateCcw size={12} /> Reabrir
              </button>
            )}
            <span className={styles.actionId}>
              ID · <code>{feedback.id}</code>
            </span>
          </section>
        </div>
      )}
    </article>
  );
}

// ─── helpers ─────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function detectDevice(ua: string): string {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function formatDateAR(d: Date): string {
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const yyyy = ar.getUTCFullYear();
  const mm = String(ar.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ar.getUTCDate()).padStart(2, "0");
  const hh = String(ar.getUTCHours()).padStart(2, "0");
  const mi = String(ar.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
