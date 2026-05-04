"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  FileText,
  MessageSquare,
} from "lucide-react";
import styles from "./NotificationsBell.module.css";

// ═══════════════════════════════════════════════════════════════
//  NotificationsBell · S3-L5
//  ─────────────────────────────────────────────────────────────
//  Reemplaza el Bell decorativo del Topbar por uno funcional con
//  dropdown · fetch lazy a /api/notifications on open.
// ═══════════════════════════════════════════════════════════════

interface NotificationItem {
  id: string;
  kind: "alarm" | "boletin" | "feedback";
  title: string;
  detail: string;
  href: string;
  at: string; // ISO date
  tone: "alert" | "warn" | "info";
}

interface Bundle {
  items: NotificationItem[];
  unreadCount: number;
}

const ICON_MAP: Record<NotificationItem["kind"], React.ReactNode> = {
  alarm: <AlertTriangle size={14} />,
  boletin: <FileText size={14} />,
  feedback: <MessageSquare size={14} />,
};

export function NotificationsBell({ buttonClass }: { buttonClass: string }) {
  const [open, setOpen] = useState(false);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadHint, setUnreadHint] = useState<boolean>(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Click-outside to close ─────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // ── Fetch on open ──────────────────────────────────────
  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Bundle;
      setBundle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !bundle) {
      void fetchNotifs();
    }
    if (next) {
      setUnreadHint(false); // mark as "seen" en cuanto se abre el dropdown
    }
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={buttonClass}
        onClick={toggleOpen}
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        <Bell size={15} />
        {unreadHint && <span className={styles.dot} />}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notificaciones">
          <header className={styles.head}>
            <span className={styles.headTitle}>Notificaciones</span>
            {bundle && bundle.items.length > 0 && (
              <span className={styles.headCount}>{bundle.items.length}</span>
            )}
          </header>

          <div className={styles.body}>
            {loading && (
              <div className={styles.loading}>Cargando…</div>
            )}
            {error && !loading && (
              <div className={styles.error}>
                No pudimos cargar las notificaciones.
              </div>
            )}
            {!loading && !error && bundle && bundle.items.length === 0 && (
              <div className={styles.empty}>
                <Bell size={20} className={styles.emptyIcon} />
                <p>Estás al día</p>
                <span>No hay alarmas críticas ni novedades.</span>
              </div>
            )}
            {!loading && !error && bundle && bundle.items.length > 0 && (
              <ul className={styles.list}>
                {bundle.items.map((n) => (
                  <li key={n.id} className={styles.item}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className={styles.itemLink}
                    >
                      <span
                        className={`${styles.itemIcon} ${styles[`tone_${n.tone}`]!}`}
                      >
                        {ICON_MAP[n.kind]}
                      </span>
                      <div className={styles.itemBody}>
                        <span className={styles.itemTitle}>{n.title}</span>
                        <span className={styles.itemDetail}>{n.detail}</span>
                        <span className={styles.itemTime}>
                          {formatRelative(new Date(n.at))}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className={styles.foot}>
            <Link
              href="/configuracion?seccion=notificaciones"
              onClick={() => setOpen(false)}
              className={styles.footLink}
            >
              Preferencias de notificación →
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}

// ─── helper ──────────────────────────────────────────────────

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const dd = Math.floor(h / 24);
  return `hace ${dd}d`;
}
