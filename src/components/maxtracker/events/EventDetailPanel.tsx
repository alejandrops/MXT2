"use client";

import { useRouter } from "next/navigation";
import {
  EntityDetailPanel,
  PanelDataSection,
  PanelMapSection,
  PanelActionsSection,
  type DataRow,
} from "@/components/maxtracker/EntityDetailPanel";
import {
  TimestampCell,
  VehicleCell,
  DriverCell,
  SeverityBadge,
  SpeedCell,
  EventTypeCell,
} from "@/components/maxtracker/cells";
import { EVENT_TYPE_LABEL, mapSeverityToSemantic } from "@/lib/format";
import type { EventListRow } from "@/lib/queries/events-list";

// ═══════════════════════════════════════════════════════════════
//  EventDetailPanel · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  Reescrito sobre EntityDetailPanel + cells canónicos. Es la
//  pantalla de referencia para todos los demás side panels del
//  sistema (Alarmas e Infracciones siguen este patrón).
//
//  Composición:
//    · Header → kicker "Evento" + título (label del tipo) +
//      subtítulo (vehículo + timestamp largo)
//    · Sección "Detalles" → tipo, severidad, vehículo, conductor,
//      velocidad, fecha
//    · Sección "Ubicación" → mini-mapa con pin (si lat/lng)
//    · Sección "Acciones" → ver en libro del vehículo
// ═══════════════════════════════════════════════════════════════

const SEVERITY_COLORS: Record<string, string> = {
  info: "#94a3b8",
  warning: "#f59e0b",
  danger: "#ea580c",
  critical: "#dc2626",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  HARSH_BRAKING: "#ea580c",
  HARSH_ACCELERATION: "#ea580c",
  HARSH_CORNERING: "#f59e0b",
  SPEEDING: "#dc2626",
  IDLING: "#94a3b8",
  IGNITION_ON: "#22c55e",
  IGNITION_OFF: "#64748b",
  PANIC_BUTTON: "#dc2626",
  UNAUTHORIZED_USE: "#dc2626",
  DOOR_OPEN: "#f59e0b",
  SIDE_DOOR_OPEN: "#f59e0b",
  CARGO_DOOR_OPEN: "#f59e0b",
  TRAILER_DETACH: "#dc2626",
  GPS_DISCONNECT: "#dc2626",
  POWER_DISCONNECT: "#dc2626",
  JAMMING_DETECTED: "#dc2626",
  SABOTAGE: "#dc2626",
  GEOFENCE_ENTRY: "#94a3b8",
  GEOFENCE_EXIT: "#94a3b8",
};

interface Props {
  event: EventListRow | null;
  onClose: () => void;
}

export function EventDetailPanel({ event, onClose }: Props) {
  const router = useRouter();

  if (!event) {
    return (
      <EntityDetailPanel
        open={false}
        onClose={onClose}
        title=""
      >
        <div />
      </EntityDetailPanel>
    );
  }

  const semantic = mapSeverityToSemantic(event.severity);
  const accentColor = SEVERITY_COLORS[semantic];
  const eventTypeColor = EVENT_TYPE_COLORS[event.type] ?? "#94a3b8";
  const eventTypeLabel = EVENT_TYPE_LABEL[event.type] ?? event.type;

  // Subtítulo · vehículo + fecha larga
  const subtitle = (
    <>
      <strong style={{ fontWeight: 500, color: "#374151" }}>
        {event.assetName}
      </strong>
      {event.assetPlate && (
        <span
          style={{
            fontFamily: "var(--m)",
            color: "#6b7280",
            marginLeft: 8,
          }}
        >
          {event.assetPlate}
        </span>
      )}
      {" · "}
      <span style={{ fontFamily: "var(--m)", color: "#6b7280" }}>
        <TimestampCellInline iso={event.occurredAt} />
      </span>
    </>
  );

  const dataRows: DataRow[] = [
    {
      label: "Tipo",
      value: <EventTypeCell type={event.type} color={eventTypeColor} />,
    },
    {
      label: "Severidad",
      value: <SeverityBadge level={event.severity} />,
    },
    {
      label: "Vehículo",
      value: (
        <VehicleCell
          asset={{
            id: event.assetId,
            name: event.assetName,
            plate: event.assetPlate,
          }}
        />
      ),
    },
    {
      label: "Conductor",
      value: (
        <DriverCell
          person={
            event.personId && event.personName
              ? { id: event.personId, name: event.personName }
              : null
          }
        />
      ),
    },
  ];

  if (event.speedKmh !== null && event.speedKmh !== undefined) {
    dataRows.push({
      label: "Velocidad",
      value: <SpeedCell kmh={event.speedKmh} />,
    });
  }

  dataRows.push({
    label: "Fecha",
    value: <TimestampCellInlineLong iso={event.occurredAt} />,
  });

  const hasLocation = event.lat != null && event.lng != null;

  return (
    <EntityDetailPanel
      open={true}
      onClose={onClose}
      kicker="Evento"
      title={eventTypeLabel}
      subtitle={subtitle}
      accentColor={accentColor}
    >
      <PanelDataSection title="Detalles" rows={dataRows} />

      {hasLocation && (
        <PanelMapSection
          title="Ubicación"
          lat={event.lat}
          lng={event.lng}
          color={eventTypeColor}
          height={200}
        />
      )}

      <PanelActionsSection title="Acciones">
        <button
          type="button"
          style={btnSecondary}
          onClick={() => {
            onClose();
            router.push(`/objeto/vehiculo/${event.assetId}`);
          }}
        >
          Ver libro del vehículo
        </button>
      </PanelActionsSection>
    </EntityDetailPanel>
  );
}

// Cells inline cortos para usar dentro del subtitle (que es string|ReactNode)
function TimestampCellInline({ iso }: { iso: Date | string }) {
  return <TimestampCell iso={iso} />;
}
function TimestampCellInlineLong({ iso }: { iso: Date | string }) {
  return <TimestampCell iso={iso} variant="long" />;
}

const btnSecondary: React.CSSProperties = {
  width: "100%",
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
};
