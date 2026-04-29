"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionData } from "@/lib/session";
import { updateNotificaciones } from "./actions";
import sharedStyles from "./ConfiguracionPage.module.css";
import styles from "./NotificacionesTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab "Notificaciones"
//  ─────────────────────────────────────────────────────────────
//  4 switches por evento. Persisten en User (campos bool ya
//  existen desde Lote F1). El demo NO envía emails reales · solo
//  guarda la preferencia para cuando se conecte el sistema de
//  notificaciones (post-MVP).
// ═══════════════════════════════════════════════════════════════

interface Props {
  session: SessionData;
}

interface SwitchDef {
  key:
    | "notifyAlarmHighCrit"
    | "notifyScoreDrop"
    | "notifyBoletinClosed"
    | "notifyCriticalEvent";
  label: string;
  description: string;
}

const SWITCHES: SwitchDef[] = [
  {
    key: "notifyAlarmHighCrit",
    label: "Alarmas críticas",
    description:
      "Recibí un email cuando se dispara una alarma de severidad alta o crítica en cualquier vehículo de tu cliente.",
  },
  {
    key: "notifyScoreDrop",
    label: "Conductor con score bajando",
    description:
      "Cuando el score de seguridad de un conductor baja más de 5 puntos en una semana respecto al promedio anterior.",
  },
  {
    key: "notifyBoletinClosed",
    label: "Boletín mensual cerrado",
    description:
      "Aviso al cierre del período cuando el boletín está listo para revisar y compartir.",
  },
  {
    key: "notifyCriticalEvent",
    label: "Evento crítico individual",
    description:
      "Eventos puntuales como frenadas bruscas, exceso >20% sobre el límite o aceleraciones violentas.",
  },
];

export function NotificacionesTab({ session }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [values, setValues] = useState({
    notifyAlarmHighCrit: session.user.notifyAlarmHighCrit,
    notifyScoreDrop: session.user.notifyScoreDrop,
    notifyBoletinClosed: session.user.notifyBoletinClosed,
    notifyCriticalEvent: session.user.notifyCriticalEvent,
  });

  const isDirty =
    values.notifyAlarmHighCrit !== session.user.notifyAlarmHighCrit ||
    values.notifyScoreDrop !== session.user.notifyScoreDrop ||
    values.notifyBoletinClosed !== session.user.notifyBoletinClosed ||
    values.notifyCriticalEvent !== session.user.notifyCriticalEvent;

  function toggle(key: SwitchDef["key"]) {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
    setSuccessMsg(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await updateNotificaciones(values);
      if (result.ok) {
        setSuccessMsg(result.message ?? "Notificaciones actualizadas");
        router.refresh();
      }
    });
  }

  return (
    <div className={styles.container}>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Notificaciones</h2>
        <p className={sharedStyles.tabSubtitle}>
          Elegí qué eventos te llegan por email. Recibirás avisos en{" "}
          <strong>{session.user.email}</strong>.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <div className={styles.switchList}>
          {SWITCHES.map((sw) => (
            <label key={sw.key} className={styles.switchItem}>
              <div className={styles.switchInfo}>
                <span className={styles.switchLabel}>{sw.label}</span>
                <span className={styles.switchDesc}>{sw.description}</span>
              </div>
              <Switch
                checked={values[sw.key]}
                onChange={() => toggle(sw.key)}
                disabled={isPending}
              />
            </label>
          ))}
        </div>

        <div className={styles.formFooter}>
          {successMsg && (
            <span className={styles.successMsg}>{successMsg}</span>
          )}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isPending || !isDirty}
          >
            {isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Switch · accessible toggle
// ═══════════════════════════════════════════════════════════════

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
    >
      <span className={styles.switchThumb} />
    </button>
  );
}
