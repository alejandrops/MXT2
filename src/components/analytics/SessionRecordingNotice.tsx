"use client";

import { useState, useEffect, useCallback } from "react";
import { Video, X, Pause, Play } from "lucide-react";
import {
  isSessionRecordingPausedByUser,
  pauseSessionRecording,
  resumeSessionRecording,
  track,
} from "@/lib/analytics/posthog";
import styles from "./SessionRecordingNotice.module.css";

// ═══════════════════════════════════════════════════════════════
//  SessionRecordingNotice · S1-L9 posthog-events
//  ─────────────────────────────────────────────────────────────
//  Banner persistente bottom-left que avisa al user que su
//  sesión está siendo grabada para fines de mejora del producto.
//
//  Solo se renderiza si NEXT_PUBLIC_ENABLE_SESSION_REPLAY === "1".
//  Es decir, en builds de tester / beta.
//
//  Permite:
//    · Pausar grabación (persiste en localStorage)
//    · Reanudar grabación
//    · Cerrar el banner (oculto, pero la grabación sigue activa)
//
//  Privacy:
//    · Aviso siempre visible mientras se graba · GDPR-friendly
//    · Cerrar el banner NO desactiva la grabación · solo oculta
//      el aviso · conviene mostrar el control de pausa también
//      en /configuracion (para que el user pueda volver a verlo).
// ═══════════════════════════════════════════════════════════════

const HIDDEN_KEY = "mxt_session_notice_hidden";

export function SessionRecordingNotice() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_SESSION_REPLAY === "1";

  const [hidden, setHidden] = useState(true); // true por default · evita flash en mount
  const [paused, setPaused] = useState(false);

  // Mount · leer estado inicial de localStorage
  useEffect(() => {
    if (!enabled) return;
    setPaused(isSessionRecordingPausedByUser());
    try {
      const wasHidden = window.localStorage.getItem(HIDDEN_KEY) === "1";
      setHidden(wasHidden);
    } catch {
      setHidden(false);
    }
  }, [enabled]);

  const togglePause = useCallback(() => {
    if (paused) {
      resumeSessionRecording();
      track("session_recording_resumed", {});
      setPaused(false);
    } else {
      pauseSessionRecording();
      track("session_recording_paused", {});
      setPaused(true);
    }
  }, [paused]);

  const closeBanner = useCallback(() => {
    try {
      window.localStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      // ignorar
    }
    setHidden(true);
  }, []);

  if (!enabled || hidden) return null;

  return (
    <div className={styles.notice} role="status" aria-live="polite">
      <div className={styles.iconWrap}>
        <Video size={14} className={styles.icon} />
        {!paused && <span className={styles.dot} aria-hidden />}
      </div>
      <div className={styles.body}>
        <span className={styles.title}>
          {paused ? "Grabación pausada" : "Estamos grabando tu sesión"}
        </span>
        <span className={styles.subtitle}>
          {paused
            ? "Reanudá si querés ayudarnos a mejorar."
            : "Para entender cómo usás Maxtracker. Pausá si preferís."}
        </span>
      </div>
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={togglePause}
        title={paused ? "Reanudar grabación" : "Pausar grabación"}
        aria-label={paused ? "Reanudar grabación" : "Pausar grabación"}
      >
        {paused ? <Play size={12} /> : <Pause size={12} />}
        <span>{paused ? "Reanudar" : "Pausar"}</span>
      </button>
      <button
        type="button"
        className={styles.closeBtn}
        onClick={closeBanner}
        title="Ocultar aviso"
        aria-label="Ocultar aviso"
      >
        <X size={12} />
      </button>
    </div>
  );
}
