"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  buildDriverEventsHref,
  hasActiveDriverEventsFilters,
  type DriverEventsParams,
} from "@/lib/url-driver-events";
import { EVENT_TYPE_LABEL, SEVERITY_LABEL } from "@/lib/format";
import type { EventType, Severity } from "@/types/domain";
import styles from "./DriverEventFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverEventFilterBar · Sub-lote 3.3
//  ─────────────────────────────────────────────────────────────
//  Filters for the Eventos tab in Libro del Conductor.
//  Shows ALL EventType values (both Conducción and Seguridad)
//  because the Libro shows everything the driver was involved in.
// ═══════════════════════════════════════════════════════════════

interface DriverEventFilterBarProps {
  personId: string;
  current: DriverEventsParams;
}

const EVENT_TYPE_OPTIONS: EventType[] = [
  // Conducción
  "HARSH_BRAKING",
  "HARSH_ACCELERATION",
  "HARSH_CORNERING",
  "SPEEDING",
  "IDLING",
  "IGNITION_ON",
  "IGNITION_OFF",
  // Seguridad
  "PANIC_BUTTON",
  "UNAUTHORIZED_USE",
  "DOOR_OPEN",
  "SIDE_DOOR_OPEN",
  "CARGO_DOOR_OPEN",
  "TRAILER_DETACH",
  "GPS_DISCONNECT",
  "POWER_DISCONNECT",
  "JAMMING_DETECTED",
  "SABOTAGE",
  // Transversales
  "GEOFENCE_ENTRY",
  "GEOFENCE_EXIT",
];

const SEVERITY_OPTIONS: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function DriverEventFilterBar({
  personId,
  current,
}: DriverEventFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function nav(override: Partial<DriverEventsParams>) {
    const href = buildDriverEventsHref(personId, current, override);
    startTransition(() => router.push(href));
  }

  return (
    <div className={styles.bar}>
      <Select
        label="Tipo"
        value={current.driverEventType}
        options={EVENT_TYPE_OPTIONS.map((t) => ({
          value: t,
          label: EVENT_TYPE_LABEL[t] ?? t,
        }))}
        onChange={(v) => nav({ driverEventType: v as EventType | null })}
      />

      <Select
        label="Severidad"
        value={current.driverEventSeverity}
        options={SEVERITY_OPTIONS.map((s) => ({
          value: s,
          label: SEVERITY_LABEL[s] ?? s,
        }))}
        onChange={(v) =>
          nav({ driverEventSeverity: v as Severity | null })
        }
      />

      {hasActiveDriverEventsFilters(current) && (
        <Link
          href={`/gestion/conductores/${personId}?tab=eventos`}
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
