"use client";

import { ArrowLeft, ExternalLink, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import {
  CommDot,
  CoordRow,
  DriverCard,
  Dot,
  Num,
  PanelShell,
  PlaceholderHint,
  Row,
  Rows,
  SectionHeader,
  Unit,
  commLabel,
  degToCardinal,
  speedAccent,
} from "./DetailBlocks";
import styles from "./AssetDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetDetailPanel · Mapa right-side detail panel
//  ─────────────────────────────────────────────────────────────
//  Sections (mirrors TelemetryPanel structure):
//    1. ESTADO     · velocidad, rumbo, motor, comunicación
//    2. POSICIÓN   · lat/lng + abrir en Google Maps
//    3. ENTRADAS   · placeholder (no schema yet)
//    4. SENSORES   · placeholder (no schema yet)
//    5. CONDUCTOR  · driver card (if any)
//
//  Building blocks come from DetailBlocks so the styling matches
//  the Históricos panel exactly.
// ═══════════════════════════════════════════════════════════════

interface AssetDetailPanelProps {
  asset: FleetAssetLive;
  onBack: () => void;
}

export function AssetDetailPanel({
  asset,
  onBack,
}: AssetDetailPanelProps) {
  const speed = Math.round(asset.speedKmh);

  return (
    <PanelShell>
      {/* ── Back button (specific to this panel) ──────────── */}
      <button type="button" className={styles.backBtn} onClick={onBack}>
        <ArrowLeft size={13} /> Volver a la flota
      </button>

      {/* ── Vehicle header ────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <Truck size={14} className={styles.headerIcon} />
          <div className={styles.headerText}>
            <div className={styles.assetName}>{asset.name}</div>
            {asset.plate && (
              <div className={styles.assetPlate}>{asset.plate}</div>
            )}
          </div>
        </div>
        {(asset.make || asset.model) && (
          <div className={styles.makeModel}>
            {[asset.make, asset.model].filter(Boolean).join(" · ")}
          </div>
        )}
      </header>

      {/* ── Estado ────────────────────────────────────────── */}
      <SectionHeader label="Estado" />
      <Rows>
        <Row label="Velocidad" accent={speedAccent(speed)}>
          <Num>{speed}</Num>
          <Unit>km/h</Unit>
        </Row>
        <Row label="Rumbo">
          <Num>{degToCardinal(asset.heading)}</Num>
          <Unit>{asset.heading}°</Unit>
        </Row>
        <Row label="Motor">
          <Dot on={asset.ignition} />
          <Num>{asset.ignition ? "Encendido" : "Apagado"}</Num>
        </Row>
        <Row label="Comunicación">
          <CommDot state={asset.commState} />
          <Num>{commLabel(asset.msSinceLastSeen)}</Num>
        </Row>
      </Rows>

      {/* ── Posición ──────────────────────────────────────── */}
      <SectionHeader label="Posición" />
      <Rows>
        <CoordRow label="Latitud" value={asset.lat} />
        <CoordRow label="Longitud" value={asset.lng} />
      </Rows>
      <a
        className={styles.smallAction}
        target="_blank"
        rel="noreferrer"
        href={`https://www.google.com/maps?q=${asset.lat},${asset.lng}`}
        title="Abrir en Google Maps"
      >
        <MapPin size={11} /> Abrir en Google Maps
      </a>

      {/* ── Entradas · placeholder ────────────────────────── */}
      <SectionHeader label="Entradas" />
      {asset.canData ? (
        <Rows>
          <Row label="Puerta conductor">
            <Dot on={!asset.canData.doorOpen} />
            <Num>{asset.canData.doorOpen ? "Abierta" : "Cerrada"}</Num>
          </Row>
          <Row label="Cinturón">
            <Dot on={asset.canData.seatbeltOk} />
            <Num>{asset.canData.seatbeltOk ? "OK" : "Sin colocar"}</Num>
          </Row>
          <Row label="Freno de mano">
            <Dot on={asset.canData.parkingBrake} />
            <Num>{asset.canData.parkingBrake ? "Puesto" : "Liberado"}</Num>
          </Row>
          {asset.canData.ptoActive && (
            <Row label="PTO">
              <Dot on={true} />
              <Num>Activo</Num>
            </Row>
          )}
        </Rows>
      ) : (
        <PlaceholderHint>
          {asset.deviceModel === "Legacy"
            ? "Equipo legacy · sin reporte de estados de vehículo."
            : "Sin acceso al bus CAN · estados no disponibles."}
        </PlaceholderHint>
      )}

      {/* ── Sensores / Telemetría CAN ─────────────────────── */}
      <SectionHeader label="Telemetría CAN" />
      {asset.canData ? (
        <>
          <Rows>
            <Row label="RPM motor">
              <Num>{asset.canData.rpm}</Num>
              <Unit>rpm</Unit>
            </Row>
            <Row label="Temp. motor">
              <Num>{asset.canData.engineTempC.toFixed(1)}</Num>
              <Unit>°C</Unit>
            </Row>
            <Row label="Presión aceite">
              <Num>{asset.canData.oilPressureKpa}</Num>
              <Unit>kPa</Unit>
            </Row>
          </Rows>
          <SectionHeader label="Combustible" />
          <Rows>
            <Row label="Nivel">
              <Num>{asset.canData.fuelLevelPct.toFixed(0)}</Num>
              <Unit>%</Unit>
            </Row>
            <Row label="Consumo">
              <Num>
                {asset.canData.fuelConsumptionLper100km > 0
                  ? asset.canData.fuelConsumptionLper100km.toFixed(1)
                  : "—"}
              </Num>
              <Unit>L/100km</Unit>
            </Row>
            <Row label="Eficiencia">
              <Num>
                {asset.canData.fuelEfficiencyKmL > 0
                  ? asset.canData.fuelEfficiencyKmL.toFixed(2)
                  : "—"}
              </Num>
              <Unit>km/L</Unit>
            </Row>
          </Rows>
          <SectionHeader label="Distancia y uso" />
          <Rows>
            <Row label="Odómetro real">
              <Num>{asset.canData.odometerKm.toLocaleString("es-AR")}</Num>
              <Unit>km</Unit>
            </Row>
            <Row label="Horas motor">
              <Num>{asset.canData.engineHours.toFixed(1)}</Num>
              <Unit>hs</Unit>
            </Row>
            <Row label="Idle hoy">
              <Num>
                {Math.floor(asset.canData.idleSecondsToday / 60)}
              </Num>
              <Unit>min</Unit>
            </Row>
            <Row label="Eco-score">
              <Num>{asset.canData.ecoScore}</Num>
              <Unit>/100</Unit>
            </Row>
          </Rows>
          {asset.canData.dtcCodes.length > 0 && (
            <>
              <SectionHeader label="Diagnóstico" />
              <Rows>
                <Row label="Códigos activos" accent="warn">
                  <Num>{asset.canData.dtcCodes.join(" · ")}</Num>
                </Row>
              </Rows>
            </>
          )}
        </>
      ) : (
        <PlaceholderHint>
          {asset.deviceModel === "FMB920"
            ? "Equipo FMB920 · solo GPS, sin acceso al bus CAN."
            : "Equipo legacy · datos de motor no disponibles."}
        </PlaceholderHint>
      )}

      {/* ── Conductor ─────────────────────────────────────── */}
      {asset.driver ? (
        <DriverCard driver={asset.driver} />
      ) : (
        <>
          <SectionHeader label="Conductor" />
          <PlaceholderHint>No asignado en este momento.</PlaceholderHint>
        </>
      )}

      {/* ── Footer · device model ─────────────────────────── */}
      {asset.deviceModel && (
        <div className={styles.deviceFooter}>
          Equipo: <span className={styles.deviceModel}>{asset.deviceModel}</span>
          {asset.canData ? null : <span className={styles.deviceCap}> · sin CAN</span>}
        </div>
      )}

      {/* ── Footer action ─────────────────────────────────── */}
      <Link
        className={styles.primaryAction}
        href={`/seguimiento/historial?assetId=${asset.id}`}
      >
        Ver historial del día
        <ExternalLink size={12} />
      </Link>
    </PanelShell>
  );
}
