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
      <PlaceholderHint>
        Se mostrarán cuando el dispositivo reporte estados (puerta,
        pánico, alimentación, etc.).
      </PlaceholderHint>

      {/* ── Sensores · placeholder ────────────────────────── */}
      <SectionHeader label="Sensores" />
      <PlaceholderHint>
        Se mostrarán cuando estén disponibles (temperatura, RPM,
        combustible).
      </PlaceholderHint>

      {/* ── Conductor ─────────────────────────────────────── */}
      {asset.driver ? (
        <DriverCard driver={asset.driver} />
      ) : (
        <>
          <SectionHeader label="Conductor" />
          <PlaceholderHint>No asignado en este momento.</PlaceholderHint>
        </>
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
