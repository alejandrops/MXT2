"use client";

import { useState, useTransition } from "react";
import { Check, X, AlertCircle } from "lucide-react";
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
} from "@/components/maxtracker/cells";
import { StatusBadge, type AlarmStatusValue } from "./StatusBadge";
import { AlarmTypeCell, alarmTypeLabel } from "./AlarmTypeCell";
import {
  attendAlarm,
  closeAlarm,
  dismissAlarm,
} from "@/app/(product)/seguridad/alarmas/actions";
import styles from "./AlarmDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  AlarmDetailPanel · S5-T5
//  ─────────────────────────────────────────────────────────────
//  Side panel canónico para alarmas · usa EntityDetailPanel +
//  cells canónicos. Las acciones (atender · cerrar · descartar)
//  van en PanelActionsSection · llaman a Server Actions.
// ═══════════════════════════════════════════════════════════════

interface AlarmRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  triggeredAt: Date | string;
  attendedAt?: Date | string | null;
  closedAt?: Date | string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  asset: { id: string; name: string; plate: string | null };
  person: { id: string; firstName: string; lastName: string } | null;
}

interface Props {
  alarm: AlarmRow | null;
  onClose: () => void;
}

export function AlarmDetailPanel({ alarm, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  if (!alarm) {
    return (
      <EntityDetailPanel open={false} onClose={onClose} title="">
        <div />
      </EntityDetailPanel>
    );
  }

  const status = alarm.status as AlarmStatusValue;
  const isTerminal = status === "CLOSED" || status === "DISMISSED";

  const subtitle = (
    <>
      <strong style={{ fontWeight: 500, color: "#374151" }}>
        {alarmTypeLabel(alarm.type)}
      </strong>
      {" · "}
      <StatusBadge status={status} />
    </>
  );

  const dataRows: DataRow[] = [
    {
      label: "Severidad",
      value: <SeverityBadge level={alarm.severity as any} />,
    },
    {
      label: "Disparada",
      value: (
        <TimestampCell
          iso={alarm.triggeredAt}
          variant="long"
        />
      ),
    },
    ...(alarm.attendedAt
      ? [
          {
            label: "Atendida",
            value: (
              <TimestampCell iso={alarm.attendedAt} variant="long" />
            ),
          } as DataRow,
        ]
      : []),
    ...(alarm.closedAt
      ? [
          {
            label: status === "DISMISSED" ? "Descartada" : "Cerrada",
            value: <TimestampCell iso={alarm.closedAt} variant="long" />,
          } as DataRow,
        ]
      : []),
    {
      label: "Vehículo",
      value: (
        <VehicleCell
          asset={{
            id: alarm.asset.id,
            name: alarm.asset.name,
            plate: alarm.asset.plate,
          }}
        />
      ),
    },
    {
      label: "Conductor",
      value: (
        <DriverCell
          person={
            alarm.person
              ? {
                  id: alarm.person.id,
                  name: `${alarm.person.firstName} ${alarm.person.lastName}`.trim(),
                }
              : null
          }
        />
      ),
    },
    ...(alarm.notes
      ? [
          {
            label: "Notas",
            value: <span className={styles.notes}>{alarm.notes}</span>,
          } as DataRow,
        ]
      : []),
  ];

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error ?? "No se pudo completar la acción");
      } else {
        onClose();
      }
    });
  }

  return (
    <EntityDetailPanel
      open={true}
      onClose={onClose}
      kicker="Alarma"
      title={alarmTypeLabel(alarm.type)}
      subtitle={subtitle}
    >
      <PanelDataSection title="Detalles" rows={dataRows} />

      {alarm.lat != null && alarm.lng != null && (
        <PanelMapSection
          title="Ubicación al disparo"
          startLat={alarm.lat}
          startLng={alarm.lng}
          color="#dc2626"
          height={200}
        />
      )}

      {!isTerminal && (
        <PanelActionsSection title="Acciones">
          <div className={styles.actionsWrap}>
            {status === "OPEN" && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.attend}`}
                disabled={isPending}
                onClick={() => runAction(() => attendAlarm(alarm.id))}
              >
                <AlertCircle size={13} />
                <span>Atender</span>
              </button>
            )}
            {(status === "OPEN" || status === "ATTENDED") && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.close}`}
                disabled={isPending}
                onClick={() => runAction(() => closeAlarm(alarm.id))}
              >
                <Check size={13} />
                <span>Cerrar</span>
              </button>
            )}
            {(status === "OPEN" || status === "ATTENDED") && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.dismiss}`}
                disabled={isPending}
                onClick={() => runAction(() => dismissAlarm(alarm.id))}
              >
                <X size={13} />
                <span>Descartar (falso positivo)</span>
              </button>
            )}
          </div>
          {actionError && (
            <div className={styles.actionError}>{actionError}</div>
          )}
        </PanelActionsSection>
      )}

      {isTerminal && (
        <div className={styles.terminalNote}>
          Esta alarma ya está {status === "CLOSED" ? "cerrada" : "descartada"} ·
          no admite más acciones.
        </div>
      )}
    </EntityDetailPanel>
  );
}
