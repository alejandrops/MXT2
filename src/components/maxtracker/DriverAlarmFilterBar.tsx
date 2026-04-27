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
import styles from "./DriverAlarmFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverAlarmFilterBar · Sub-lote 3.3
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

// Seguridad-only AlarmType values (this lives in Seguridad module).
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
    const href = buildDriverAlarmsHref(personId, current, override);
    startTransition(() => router.push(href));
  }

  return (
    <div className={styles.bar}>
      <Select
        label="Estado"
        value={current.driverAlarmStatus}
        options={STATUS_OPTIONS.map((s) => ({
          value: s,
          label: ALARM_STATUS_LABEL[s] ?? s,
        }))}
        onChange={(v) =>
          nav({ driverAlarmStatus: v as AlarmStatus | null })
        }
      />

      <Select
        label="Severidad"
        value={current.driverAlarmSeverity}
        options={SEVERITY_OPTIONS.map((s) => ({
          value: s,
          label: SEVERITY_LABEL[s] ?? s,
        }))}
        onChange={(v) =>
          nav({ driverAlarmSeverity: v as Severity | null })
        }
      />

      <Select
        label="Tipo"
        value={current.driverAlarmType}
        options={TYPE_OPTIONS.map((t) => ({
          value: t,
          label: ALARM_TYPE_LABEL[t] ?? t,
        }))}
        onChange={(v) => nav({ driverAlarmType: v as AlarmType | null })}
      />

      {hasActiveDriverAlarmsFilters(current) && (
        <Link
          href={`/gestion/conductores/${personId}?tab=alarmas`}
          className={styles.clearAll}
          scroll={false}
        >
          <X size={11} />
          Limpiar filtros
        </Link>
      )}
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
  const isActive = value !== null;
  return (
    <label
      className={`${styles.select} ${isActive ? styles.selectActive : ""}`}
    >
      <span className={styles.selectLabel}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value)
        }
        className={styles.selectNative}
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
