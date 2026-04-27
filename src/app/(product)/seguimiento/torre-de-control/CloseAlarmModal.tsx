"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { AlarmDetail } from "@/lib/queries/torre";
import styles from "./CloseAlarmModal.module.css";

interface Props {
  open: boolean;
  alarm: AlarmDetail | null;
  onCancel: () => void;
  /** Returns null on success, error string on failure */
  onConfirm: (notes: string) => Promise<string | null>;
}

const QUICK_NOTES = [
  "Falsa alarma · sensor disparado por bache",
  "Conductor confirmó incidente menor · sin daños",
  "Resolución: contacto telefónico OK",
  "Investigación pendiente · derivado a supervisor",
];

export function CloseAlarmModal({ open, alarm, onCancel, onConfirm }: Props) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setNotes("");
      setError(null);
      setPending(false);
      setTimeout(() => ref.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open || !alarm) return null;

  async function submit() {
    setError(null);
    if (notes.trim().length < 3) {
      setError("La nota es obligatoria (mínimo 3 caracteres)");
      ref.current?.focus();
      return;
    }
    setPending(true);
    const err = await onConfirm(notes);
    setPending(false);
    if (err) setError(err);
  }

  return (
    <div className={styles.backdrop} onClick={pending ? undefined : onCancel}>
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-alarm-title"
      >
        <header className={styles.header}>
          <h2 id="close-alarm-title" className={styles.title}>
            Cerrar alarma
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            disabled={pending}
            aria-label="Cancelar"
          >
            <X size={14} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.summary}>
            <span className={styles.summaryAsset}>{alarm.assetName}</span>
            <span className={styles.summaryDot}>·</span>
            <span className={styles.summaryType}>{alarm.typeLabel}</span>
          </div>

          <label className={styles.label}>
            Nota del operador <span className={styles.req}>*</span>
          </label>
          <textarea
            ref={ref}
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describí qué pasó, qué acciones tomaste y por qué cerrás esta alarma…"
            rows={4}
            maxLength={1000}
            disabled={pending}
          />
          <div className={styles.charCount}>{notes.length} / 1000</div>

          <div className={styles.quickNotes}>
            <span className={styles.quickNotesLabel}>Sugerencias:</span>
            {QUICK_NOTES.map((q) => (
              <button
                key={q}
                type="button"
                className={styles.quickNote}
                onClick={() => setNotes(q)}
                disabled={pending}
              >
                {q}
              </button>
            ))}
          </div>

          {error && (
            <div className={styles.error}>
              <AlertTriangle size={12} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onCancel}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={submit}
            disabled={pending || notes.trim().length < 3}
          >
            {pending ? "Cerrando…" : "Cerrar alarma"}
          </button>
        </footer>
      </div>
    </div>
  );
}
