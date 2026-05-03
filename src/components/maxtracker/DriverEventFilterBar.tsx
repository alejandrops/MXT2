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
import { FilterFieldGroup, SelectField } from "./ui";
import styles from "./DriverEventFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverEventFilterBar · L3-style-2 · Alt 2
//
//   TIPO         SEVERIDAD
//   [...]        [...]
// ═══════════════════════════════════════════════════════════════

interface DriverEventFilterBarProps {
  personId: string;
  current: DriverEventsParams;
}

const EVENT_TYPE_OPTIONS: EventType[] = [
  "HARSH_BRAKING",
  "HARSH_ACCELERATION",
  "HARSH_CORNERING",
  "SPEEDING",
  "IDLING",
  "IGNITION_ON",
  "IGNITION_OFF",
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
    startTransition(() =>
      router.push(buildDriverEventsHref(personId, current, override)),
    );
  }

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Tipo">
        <SelectField
          label="Tipo"
          value={current.driverEventType}
          options={EVENT_TYPE_OPTIONS.map((t) => ({
            value: t,
            label: EVENT_TYPE_LABEL[t] ?? t,
          }))}
          onChange={(v) => nav({ driverEventType: v as EventType | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Severidad">
        <SelectField
          label="Severidad"
          value={current.driverEventSeverity}
          options={SEVERITY_OPTIONS.map((s) => ({
            value: s,
            label: SEVERITY_LABEL[s] ?? s,
          }))}
          onChange={(v) =>
            nav({ driverEventSeverity: v as Severity | null })
          }
          variant="bare"
        />
      </FilterFieldGroup>

      {hasActiveDriverEventsFilters(current) && (
        <Link
          href={`/catalogos/conductores/${personId}?tab=eventos`}
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
