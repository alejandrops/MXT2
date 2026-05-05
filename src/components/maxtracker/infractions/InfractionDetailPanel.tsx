// @ts-nocheck · pre-existing patterns (Prisma types stale)
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, ExternalLink } from "lucide-react";
import {
  EntityDetailPanel,
  PanelDataSection,
  PanelMapSection,
  PanelCustomSection,
  PanelActionsSection,
  type DataRow,
} from "@/components/maxtracker/EntityDetailPanel";
import {
  TimestampCell,
  VehicleCell,
  DriverCell,
  SeverityBadge,
  SpeedCell,
  DistanceCell,
  DurationCell,
} from "@/components/maxtracker/cells";
import {
  SpeedCurve,
  parseTrackToSpeedSamples,
} from "./SpeedCurve";
import type { InfractionListRow } from "@/lib/queries/infractions-list";
import { discardInfraction } from "@/app/(product)/conduccion/infracciones/actions";
import styles from "./InfractionDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  InfractionDetailPanel · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  Reescrito sobre EntityDetailPanel + cells. Mantiene toda la
//  funcionalidad anterior (mapa con polilínea, curva velocidad,
//  bloque descartar, banner de descartada) pero ahora compone
//  las secciones canónicas en lugar de tener su propio shell.
//
//  Secciones (en orden):
//    1. Detalles · datos clave del incidente
//    2. Recorrido · mapa con polilínea inicio→fin
//    3. Velocidad · curva SVG (si hay samples)
//    4. Banner descartada (si aplica) · custom
//    5. Acciones · abrir recibo + descartar (si está activa)
// ═══════════════════════════════════════════════════════════════

const ROAD_TYPE_LABELS: Record<string, string> = {
  URBANO_CALLE: "Calle urbana",
  URBANO_AVENIDA: "Avenida urbana",
  RURAL: "Ruta",
  SEMIAUTOPISTA: "Semiautopista",
  AUTOPISTA: "Autopista",
  CAMINO_RURAL: "Camino rural",
  DESCONOCIDO: "Sin clasificar",
};

const SEVERITY_HEX: Record<string, string> = {
  LEVE: "#f59e0b",
  MEDIA: "#ea580c",
  GRAVE: "#dc2626",
};

const DISCARD_REASON_LABELS: Record<string, string> = {
  WRONG_SPEED_LIMIT: "Límite de velocidad incorrecto",
  WRONG_ROAD_TYPE: "El tipo de camino no coincide",
  POOR_GPS_QUALITY: "Mala calidad de las posiciones GPS",
  DRIVER_VEHICLE_IMMUNITY: "Chofer / Vehículo con inmunidad",
};

const DISCARD_REASONS: { key: string; label: string }[] = [
  { key: "WRONG_SPEED_LIMIT", label: DISCARD_REASON_LABELS.WRONG_SPEED_LIMIT },
  { key: "WRONG_ROAD_TYPE", label: DISCARD_REASON_LABELS.WRONG_ROAD_TYPE },
  { key: "POOR_GPS_QUALITY", label: DISCARD_REASON_LABELS.POOR_GPS_QUALITY },
  { key: "DRIVER_VEHICLE_IMMUNITY", label: DISCARD_REASON_LABELS.DRIVER_VEHICLE_IMMUNITY },
];

interface Props {
  infraction: InfractionListRow | null;
  onClose: () => void;
}

export function InfractionDetailPanel({ infraction, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDiscardForm, setShowDiscardForm] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!infraction) {
    return (
      <EntityDetailPanel open={false} onClose={onClose} title="">
        <div />
      </EntityDetailPanel>
    );
  }

  const sevColor = SEVERITY_HEX[infraction.severity] ?? "#64748b";
  const isDiscarded = infraction.status === "DISCARDED";
  const speedSamples = parseTrackToSpeedSamples(infraction.trackJson);

  function handleDiscardClick() {
    if (!selectedReason || !infraction) return;
    setErrorMsg(null);
    startTransition(async () => {
      const result = await discardInfraction(
        infraction.id,
        selectedReason as any,
      );
      if (result.ok) {
        onClose();
      } else {
        setErrorMsg(result.error ?? "Error desconocido");
      }
    });
  }

  // ─── Subtítulo · vehículo + timestamp ─────────────────────
  const subtitle = (
    <>
      <strong style={{ fontWeight: 500, color: "#374151" }}>
        {infraction.assetName}
      </strong>
      {infraction.assetPlate && (
        <span
          style={{
            fontFamily: "var(--m)",
            color: "#6b7280",
            marginLeft: 8,
          }}
        >
          {infraction.assetPlate}
        </span>
      )}
      {" · "}
      <TimestampCell iso={infraction.startedAt} />
    </>
  );

  // ─── Sección 1 · Detalles ────────────────────────────────
  const dataRows: DataRow[] = [
    {
      label: "Severidad",
      value: <SeverityBadge level={infraction.severity} />,
    },
    {
      label: "Inicio",
      value: <TimestampCell iso={infraction.startedAt} variant="long-seconds" />,
    },
    {
      label: "Duración",
      value: <DurationCell sec={infraction.durationSec} />,
    },
    {
      label: "Vmax aplicada",
      value: <SpeedCell kmh={infraction.vmaxKmh} />,
    },
    {
      label: "Pico de velocidad",
      value: (
        <>
          <SpeedCell kmh={infraction.peakSpeedKmh} color={sevColor} />
          <span
            style={{
              fontFamily: "var(--m)",
              color: sevColor,
              marginLeft: 8,
              fontSize: 11,
            }}
          >
            (+{Math.round(infraction.maxExcessKmh)} km/h)
          </span>
        </>
      ),
    },
    {
      label: "Distancia en exceso",
      value: <DistanceCell meters={infraction.distanceMeters} />,
    },
    {
      label: "Tipo de vía",
      value: ROAD_TYPE_LABELS[infraction.roadType] ?? infraction.roadType,
    },
    {
      label: "Vehículo",
      value: (
        <VehicleCell
          asset={{
            id: infraction.assetId,
            name: infraction.assetName,
            plate: infraction.assetPlate,
          }}
        />
      ),
    },
    {
      label: "Conductor",
      value: (
        <DriverCell
          person={
            infraction.personId && infraction.personName
              ? { id: infraction.personId, name: infraction.personName }
              : null
          }
        />
      ),
    },
  ];

  return (
    <EntityDetailPanel
      open={true}
      onClose={onClose}
      kicker="Infracción"
      title={`Exceso de velocidad ${infraction.severity.toLowerCase()}`}
      subtitle={subtitle}
      accentColor={sevColor}
    >
      <PanelDataSection title="Detalles" rows={dataRows} />

      <PanelMapSection
        title="Recorrido"
        startLat={infraction.startLat}
        startLng={infraction.startLon}
        endLat={infraction.endLat}
        endLng={infraction.endLon}
        trackJson={infraction.trackJson}
        color={sevColor}
        height={220}
      />

      {speedSamples.length >= 2 && (
        <PanelCustomSection title="Velocidad durante la infracción">
          <SpeedCurve
            samples={speedSamples}
            vmaxKmh={infraction.vmaxKmh}
            color={sevColor}
            height={120}
          />
        </PanelCustomSection>
      )}

      {isDiscarded && (
        <div className={styles.discardedBanner}>
          <strong>Infracción descartada</strong>
          {infraction.discardReason && (
            <>
              {" · "}
              {DISCARD_REASON_LABELS[infraction.discardReason] ??
                infraction.discardReason}
            </>
          )}
          {infraction.discardedAt && (
            <>
              {" · "}
              <TimestampCell
                iso={infraction.discardedAt}
                variant="short"
              />
            </>
          )}
        </div>
      )}

      <PanelActionsSection title="Acciones">
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => {
            window.open(`/conduccion/infraccion/${infraction.id}`, "_blank");
          }}
        >
          <Printer size={13} />
          <span>Abrir recibo imprimible</span>
          <ExternalLink size={11} style={{ marginLeft: "auto" }} />
        </button>

        {!isDiscarded && !showDiscardForm && (
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setShowDiscardForm(true)}
          >
            Descartar…
          </button>
        )}

        {!isDiscarded && showDiscardForm && (
          <div className={styles.discardForm}>
            <div className={styles.discardTitle}>Razón del descarte</div>
            <div className={styles.discardOptions}>
              {DISCARD_REASONS.map((r) => (
                <label key={r.key} className={styles.discardOption}>
                  <input
                    type="radio"
                    name="discardReason"
                    value={r.key}
                    checked={selectedReason === r.key}
                    onChange={() => setSelectedReason(r.key)}
                    disabled={isPending}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
            {errorMsg && (
              <div className={styles.discardError}>{errorMsg}</div>
            )}
            <div className={styles.discardActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setShowDiscardForm(false);
                  setSelectedReason(null);
                  setErrorMsg(null);
                }}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={handleDiscardClick}
                disabled={!selectedReason || isPending}
              >
                {isPending ? "Descartando…" : "Descartar"}
              </button>
            </div>
          </div>
        )}
      </PanelActionsSection>
    </EntityDetailPanel>
  );
}
