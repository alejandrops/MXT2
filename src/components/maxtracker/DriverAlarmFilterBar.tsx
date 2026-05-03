"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  buildDriverAlarmsHref,
  hasActiveDriverAlarmsFilters,
  type DriverAlarmsParams,
} from "@/lib/url-driver-alarms";
import {
  ALARM_STATUS_LABEL,
  ALARM_TYPE_LABEL,
  SEVERITY_LABEL,
} from "@/lib/format";
import type { AlarmStatus, AlarmType, Severity } from "@/types/domain";
import { FilterFieldGroup, SelectField } from "./ui";
import styles from "./DriverAlarmFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverAlarmFilterBar · L3-style-2 · Alt 2
//
//   ESTADO       SEVERIDAD     TIPO
//   [...]        [...]         [...]
// ═══════════════════════════════════════════════════════════════

interface DriverAlarmFilterBarProps {
  personId: string;
  current: DriverAlarmsParams;
}

const STATUS_OPTIONS: AlarmStatus[] = [
  "OPEN",
  "ATTENDED",
  "CLOSED",
  "DISMISSED",
];
const SEVERITY_OPTIONS: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const TYPE_OPTIONS: AlarmType[] = [
  "PANIC",
  "UNAUTHORIZED_USE",
  "SABOTAGE",
  "GPS_DISCONNECT",
  "POWER_DISCONNECT",
  "JAMMING",
  "TRAILER_DETACH",
  "CARGO_BREACH",
  "DOOR_BREACH",
  "GEOFENCE_BREACH_CRITICAL",
  "DEVICE_OFFLINE",
];

export function DriverAlarmFilterBar({
  personId,
  current,
}: DriverAlarmFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function nav(override: Partial<DriverAlarmsParams>) {
    startTransition(() =>
      router.push(buildDriverAlarmsHref(personId, current, override)),
    );
  }

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Estado">
        <SelectField
          label="Estado"
          value={current.driverAlarmStatus}
          options={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: ALARM_STATUS_LABEL[s] ?? s,
          }))}
          onChange={(v) =>
            nav({ driverAlarmStatus: v as AlarmStatus | null })
          }
          variant="bare"
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Severidad">
        <SelectField
          label="Severidad"
          value={current.driverAlarmSeverity}
          options={SEVERITY_OPTIONS.map((s) => ({
            value: s,
            label: SEVERITY_LABEL[s] ?? s,
          }))}
          onChange={(v) =>
            nav({ driverAlarmSeverity: v as Severity | null })
          }
          variant="bare"
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Tipo">
        <SelectField
          label="Tipo"
          value={current.driverAlarmType}
          options={TYPE_OPTIONS.map((t) => ({
            value: t,
            label: ALARM_TYPE_LABEL[t] ?? t,
          }))}
          onChange={(v) => nav({ driverAlarmType: v as AlarmType | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      {hasActiveDriverAlarmsFilters(current) && (
        <Link
          href={`/objeto/conductor/${personId}?m=seguridad`}
          className={styles.clearAll}
          scroll={false}
        >
          <X size={11} />
          Limpiar
        </Link>
      )}
    </div>
  );
}
