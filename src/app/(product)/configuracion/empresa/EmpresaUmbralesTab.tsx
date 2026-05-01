"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { updateEmpresaUmbrales } from "../actions-empresa";
import sharedStyles from "../ConfiguracionPage.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab Empresa · Umbrales y alarmas (S1)
//  ─────────────────────────────────────────────────────────────
//  Configura los umbrales que disparan alarmas en tu flota.
//  Defaults LATAM (g-force 0.35g vs US 0.45g).
//
//  Estos valores son consumidos por el pipeline de detección de
//  eventos · cuando se actualizan, los nuevos eventos a partir de
//  ese momento usan los nuevos umbrales (los históricos no se
//  recalculan).
// ═══════════════════════════════════════════════════════════════

interface AccountWithSettings {
  id: string;
  settings: {
    speedLimitUrban: number;
    speedLimitHighway: number;
    speedTolerancePercent: number;
    harshBrakingThreshold: number;
    harshAccelerationThreshold: number;
    harshCorneringThreshold: number;
    idlingMinDuration: number;
    tripMinDistanceKm: number;
    tripMinDurationSec: number;
  } | null;
}

interface Props {
  account: AccountWithSettings;
}

const DEFAULTS = {
  speedLimitUrban: 60,
  speedLimitHighway: 100,
  speedTolerancePercent: 10,
  harshBrakingThreshold: 0.35,
  harshAccelerationThreshold: 0.35,
  harshCorneringThreshold: 0.4,
  idlingMinDuration: 300,
  tripMinDistanceKm: 0.5,
  tripMinDurationSec: 60,
};

export function EmpresaUmbralesTab({ account }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  const s = account.settings;
  const [speedUrban, setSpeedUrban] = useState(s?.speedLimitUrban ?? DEFAULTS.speedLimitUrban);
  const [speedHighway, setSpeedHighway] = useState(s?.speedLimitHighway ?? DEFAULTS.speedLimitHighway);
  const [speedTolerance, setSpeedTolerance] = useState(s?.speedTolerancePercent ?? DEFAULTS.speedTolerancePercent);
  const [braking, setBraking] = useState(s?.harshBrakingThreshold ?? DEFAULTS.harshBrakingThreshold);
  const [acceleration, setAcceleration] = useState(s?.harshAccelerationThreshold ?? DEFAULTS.harshAccelerationThreshold);
  const [cornering, setCornering] = useState(s?.harshCorneringThreshold ?? DEFAULTS.harshCorneringThreshold);
  const [idling, setIdling] = useState(s?.idlingMinDuration ?? DEFAULTS.idlingMinDuration);
  const [tripDist, setTripDist] = useState(s?.tripMinDistanceKm ?? DEFAULTS.tripMinDistanceKm);
  const [tripDur, setTripDur] = useState(s?.tripMinDurationSec ?? DEFAULTS.tripMinDurationSec);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await updateEmpresaUmbrales({
        accountId: account.id,
        speedLimitUrban: speedUrban,
        speedLimitHighway: speedHighway,
        speedTolerancePercent: speedTolerance,
        harshBrakingThreshold: braking,
        harshAccelerationThreshold: acceleration,
        harshCorneringThreshold: cornering,
        idlingMinDuration: idling,
        tripMinDistanceKm: tripDist,
        tripMinDurationSec: tripDur,
      });

      if (result.ok) {
        setFeedback({ kind: "success", text: "Umbrales actualizados." });
        router.refresh();
      } else {
        setFeedback({ kind: "error", text: result.error });
      }
    });
  }

  function resetToDefaults() {
    setSpeedUrban(DEFAULTS.speedLimitUrban);
    setSpeedHighway(DEFAULTS.speedLimitHighway);
    setSpeedTolerance(DEFAULTS.speedTolerancePercent);
    setBraking(DEFAULTS.harshBrakingThreshold);
    setAcceleration(DEFAULTS.harshAccelerationThreshold);
    setCornering(DEFAULTS.harshCorneringThreshold);
    setIdling(DEFAULTS.idlingMinDuration);
    setTripDist(DEFAULTS.tripMinDistanceKm);
    setTripDur(DEFAULTS.tripMinDurationSec);
  }

  return (
    <form onSubmit={handleSubmit}>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Umbrales y alarmas</h2>
        <p className={sharedStyles.tabSubtitle}>
          Parámetros que disparan eventos de conducción y operación.
          Los valores por defecto están calibrados para LATAM.
        </p>
      </header>

      <div className={sharedStyles.section}>
        <h3 className={sharedStyles.sectionTitle}>Límites de velocidad</h3>
        <p className={sharedStyles.sectionDescription}>
          Velocidades máximas permitidas. La tolerancia indica cuánto puede
          superarse antes de disparar alarma · evita falsos positivos en
          mediciones GPS imprecisas.
        </p>

        <div className={sharedStyles.fieldRow}>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Zona urbana (km/h)</label>
            <input
              type="number"
              min={20}
              max={130}
              value={speedUrban}
              onChange={(e) => setSpeedUrban(Number(e.target.value))}
              className={sharedStyles.input}
              disabled={pending}
            />
          </div>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Ruta (km/h)</label>
            <input
              type="number"
              min={40}
              max={150}
              value={speedHighway}
              onChange={(e) => setSpeedHighway(Number(e.target.value))}
              className={sharedStyles.input}
              disabled={pending}
            />
          </div>
        </div>

        <div className={sharedStyles.field}>
          <label className={sharedStyles.label}>Tolerancia (%)</label>
          <input
            type="number"
            min={0}
            max={50}
            value={speedTolerance}
            onChange={(e) => setSpeedTolerance(Number(e.target.value))}
            className={sharedStyles.input}
            disabled={pending}
          />
          <span className={sharedStyles.helpText}>
            Ej. 10% sobre 100 km/h = alarma a 110 km/h.
          </span>
        </div>
      </div>

      <div className={sharedStyles.section}>
        <h3 className={sharedStyles.sectionTitle}>Conducción agresiva (g-force)</h3>
        <p className={sharedStyles.sectionDescription}>
          Mide la aceleración instantánea en gravedades (1g = 9.8 m/s²).
          El estándar US es 0.45g · LATAM bajamos a 0.35g por las
          condiciones de las calles.
        </p>

        <div className={sharedStyles.fieldRow}>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Frenada brusca (g)</label>
            <input
              type="number"
              min={0.1}
              max={1.0}
              step={0.05}
              value={braking}
              onChange={(e) => setBraking(Number(e.target.value))}
              className={sharedStyles.input}
              disabled={pending}
            />
          </div>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Aceleración brusca (g)</label>
            <input
              type="number"
              min={0.1}
              max={1.0}
              step={0.05}
              value={acceleration}
              onChange={(e) => setAcceleration(Number(e.target.value))}
              className={sharedStyles.input}
              disabled={pending}
            />
          </div>
        </div>

        <div className={sharedStyles.field}>
          <label className={sharedStyles.label}>Curva agresiva (g lateral)</label>
          <input
            type="number"
            min={0.1}
            max={1.0}
            step={0.05}
            value={cornering}
            onChange={(e) => setCornering(Number(e.target.value))}
            className={sharedStyles.input}
            disabled={pending}
          />
        </div>
      </div>

      <div className={sharedStyles.section}>
        <h3 className={sharedStyles.sectionTitle}>Operación</h3>

        <div className={sharedStyles.field}>
          <label className={sharedStyles.label}>
            Tiempo mínimo de ralentí para alarma (segundos)
          </label>
          <input
            type="number"
            min={30}
            max={3600}
            value={idling}
            onChange={(e) => setIdling(Number(e.target.value))}
            className={sharedStyles.input}
            disabled={pending}
          />
          <span className={sharedStyles.helpText}>
            Ralentí = motor encendido sin movimiento. Default 300s (5 min).
          </span>
        </div>

        <div className={sharedStyles.fieldRow}>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>
              Distancia mínima de viaje (km)
            </label>
            <input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={tripDist}
              onChange={(e) => setTripDist(Number(e.target.value))}
              className={sharedStyles.input}
              disabled={pending}
            />
          </div>
          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>
              Duración mínima de viaje (seg)
            </label>
            <input
              type="number"
              min={30}
              max={600}
              value={tripDur}
              onChange={(e) => setTripDur(Number(e.target.value))}
              className={sharedStyles.input}
              disabled={pending}
            />
          </div>
        </div>
        <span className={sharedStyles.helpText}>
          Detecciones por debajo de estos mínimos se descartan (ej. movimientos
          en patio).
        </span>
      </div>

      {feedback && (
        <div
          className={
            feedback.kind === "success"
              ? sharedStyles.successMessage
              : sharedStyles.errorMessage
          }
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className={sharedStyles.actionsRow}>
        <button
          type="button"
          className={sharedStyles.btnSecondary}
          onClick={resetToDefaults}
          disabled={pending}
        >
          <RotateCcw size={14} />
          Restaurar defaults LATAM
        </button>
        <button
          type="submit"
          className={sharedStyles.btnPrimary}
          disabled={pending}
        >
          {pending && <Loader2 size={14} className={sharedStyles.spin} />}
          Guardar cambios
        </button>
      </div>
    </form>
  );
}
