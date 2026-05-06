"use client";

import { useState } from "react";
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
  VehicleCell,
  DriverCell,
  DistanceCell,
  DurationCell,
} from "@/components/maxtracker/cells";
import { formatTimestamp } from "@/lib/format";
import type { Day, DayItem } from "@/lib/queries/trips-by-day";
import styles from "./DayDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  DayDetailPanel · S5-T3 · canónico para Viajes
//  ─────────────────────────────────────────────────────────────
//  Usa el shell EntityDetailPanel canónico (igual que Eventos e
//  Infracciones) y mete adentro:
//
//    1. Sección "Detalles" · vehículo, conductor, métricas
//    2. Sección "Cronología del día" · timeline de trips/stops
//       con click-select para resaltar uno
//    3. Sección "Recorrido" · mini-mapa con la polilínea del
//       trip seleccionado (solo si se seleccionó un trip)
// ═══════════════════════════════════════════════════════════════

const DOW = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatDayLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DOW[date.getUTCDay()]} ${String(d).padStart(2, "0")} ${MES[m - 1]} ${y}`;
}

interface Props {
  day: Day | null;
  onClose: () => void;
}

export function DayDetailPanel({ day, onClose }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  if (!day) {
    return (
      <EntityDetailPanel open={false} onClose={onClose} title="">
        <div />
      </EntityDetailPanel>
    );
  }

  const selectedItem = selectedItemId
    ? day.items.find((i) => i.id === selectedItemId) ?? null
    : null;

  const subtitle = (
    <>
      <strong style={{ fontWeight: 500, color: "#374151" }}>
        {day.assetName}
      </strong>
      {day.assetPlate && (
        <span
          style={{
            fontFamily: "var(--m)",
            color: "#6b7280",
            marginLeft: 8,
          }}
        >
          {day.assetPlate}
        </span>
      )}
      {day.driverName && (
        <>
          {" · "}
          {day.driverName}
        </>
      )}
    </>
  );

  // Datos resumen
  const dataRows: DataRow[] = [
    {
      label: "Vehículo",
      value: (
        <VehicleCell
          asset={{
            id: day.assetId,
            name: day.assetName,
            plate: day.assetPlate,
          }}
        />
      ),
    },
    {
      label: "Conductor",
      value: (
        <DriverCell
          person={
            day.driverId && day.driverName
              ? { id: day.driverId, name: day.driverName }
              : null
          }
        />
      ),
    },
    {
      label: "Distancia",
      value: <DistanceCell meters={day.totalDistanceKm * 1000} />,
    },
    {
      label: "En ruta",
      value: <DurationCell ms={day.totalDrivingMs} />,
    },
    { label: "Viajes", value: String(day.tripCount) },
    { label: "Paradas", value: String(day.stopCount) },
  ];

  return (
    <EntityDetailPanel
      open={true}
      onClose={onClose}
      kicker="Día"
      title={formatDayLong(day.dayIso)}
      subtitle={subtitle}
    >
      <PanelDataSection title="Detalles" rows={dataRows} />

      <PanelCustomSection title="Cronología del día">
        <ol className={styles.timeline}>
          {day.items.map((item) => (
            <TimelineRow
              key={item.id}
              item={item}
              isSelected={selectedItemId === item.id}
              onSelect={() =>
                setSelectedItemId(
                  item.id === selectedItemId ? null : item.id,
                )
              }
            />
          ))}
        </ol>
      </PanelCustomSection>

      {selectedItem && selectedItem.kind === "trip" && (
        <PanelMapSection
          title="Recorrido del viaje"
          startLat={selectedItem.startLat}
          startLng={selectedItem.startLng}
          endLat={selectedItem.endLat}
          endLng={selectedItem.endLng}
          color="#2563EB"
          height={200}
        />
      )}

      {selectedItem && selectedItem.kind === "trip" && (
        <PanelDataSection
          title="Detalle del viaje seleccionado"
          rows={[
            {
              label: "Inicio",
              value: formatTimestamp(selectedItem.startedAt, "time-only-seconds"),
            },
            {
              label: "Fin",
              value: formatTimestamp(selectedItem.endedAt, "time-only-seconds"),
            },
            {
              label: "Duración",
              value: <DurationCell ms={selectedItem.durationMs} />,
            },
            {
              label: "Distancia",
              value: <DistanceCell meters={selectedItem.distanceKm * 1000} />,
            },
            {
              label: "Velocidad media",
              value: `${Math.round(selectedItem.avgSpeedKmh)} km/h`,
            },
            {
              label: "Velocidad máxima",
              value: `${Math.round(selectedItem.maxSpeedKmh)} km/h`,
            },
            ...(selectedItem.eventCount > 0
              ? [
                  {
                    label: "Eventos",
                    value: (
                      <>
                        {selectedItem.eventCount}
                        {selectedItem.highSeverityEventCount > 0 && (
                          <span
                            style={{
                              color: "var(--red-dark)",
                              marginLeft: 6,
                              fontFamily: "var(--m)",
                            }}
                          >
                            ({selectedItem.highSeverityEventCount} críticos)
                          </span>
                        )}
                      </>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {selectedItem && selectedItem.kind === "stop" && (
        <PanelDataSection
          title="Detalle de la parada"
          rows={[
            {
              label: "Inicio",
              value: formatTimestamp(selectedItem.startedAt, "time-only-seconds"),
            },
            {
              label: "Fin",
              value: formatTimestamp(selectedItem.endedAt, "time-only-seconds"),
            },
            {
              label: "Duración",
              value: <DurationCell ms={selectedItem.durationMs} />,
            },
            {
              label: "Tipo",
              value: selectedItem.isLong ? "Parada larga" : "Parada",
            },
          ]}
        />
      )}

      {/* Botón "Abrir recibo" · solo cuando hay un trip seleccionado */}
      {selectedItem && selectedItem.kind === "trip" && (
        <PanelActionsSection title="Acciones">
          <button
            type="button"
            onClick={() => {
              window.open(
                `/actividad/viaje/${encodeURIComponent(selectedItem.id)}`,
                "_blank",
              );
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: "#fff",
              border: "1px solid var(--brd)",
              borderRadius: 4,
              fontFamily: "var(--f)",
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--tx)",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
          >
            <Printer size={13} />
            <span>Abrir recibo del viaje</span>
            <ExternalLink size={11} style={{ marginLeft: "auto" }} />
          </button>
        </PanelActionsSection>
      )}
    </EntityDetailPanel>
  );
}

// ─── Timeline row ───────────────────────────────────────────

function TimelineRow({
  item,
  isSelected,
  onSelect,
}: {
  item: DayItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isTrip = item.kind === "trip";
  const isLongStop = item.kind === "stop" && item.isLong;

  return (
    <li
      className={`${styles.timelineItem} ${
        isTrip ? styles.timelineTrip : styles.timelineStop
      } ${isLongStop ? styles.timelineStopLong : ""} ${
        isSelected ? styles.timelineSelected : ""
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className={styles.glyph} aria-hidden="true">
        {isTrip ? "▶" : "⏸"}
      </span>
      <span className={styles.time}>
        {formatTimestamp(item.startedAt, "time-only")} →{" "}
        {formatTimestamp(item.endedAt, "time-only")}
      </span>
      {item.kind === "trip" ? (
        <>
          <span className={styles.dot}>·</span>
          <span className={styles.value}>
            {item.distanceKm.toFixed(1)} km
          </span>
          {item.eventCount > 0 && (
            <>
              <span className={styles.dot}>·</span>
              <span
                className={
                  item.highSeverityEventCount > 0
                    ? styles.eventHot
                    : styles.dim
                }
              >
                {item.eventCount} ev
              </span>
            </>
          )}
        </>
      ) : (
        <>
          <span className={styles.dot}>·</span>
          <span className={styles.stopLabel}>
            {item.isLong ? "Parada larga" : "Parada"}
          </span>
        </>
      )}
    </li>
  );
}
