"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  buildAssetEventsHref,
  hasActiveAssetEventsFilters,
  type AssetEventsParams,
} from "@/lib/url-asset-events";
import { EVENT_TYPE_LABEL, SEVERITY_LABEL } from "@/lib/format";
import type { EventType, Severity } from "@/types/domain";
import { FilterFieldGroup, SelectField } from "./ui";
import styles from "./EventFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  EventFilterBar · L3-style-2 · Alt 2
//
//   TIPO         SEVERIDAD
//   [...]        [...]
// ═══════════════════════════════════════════════════════════════

interface EventFilterBarProps {
  assetId: string;
  current: AssetEventsParams;
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

export function EventFilterBar({ assetId, current }: EventFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function nav(override: Partial<AssetEventsParams>) {
    startTransition(() =>
      router.push(buildAssetEventsHref(assetId, current, override)),
    );
  }

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Tipo">
        <SelectField
          label="Tipo"
          value={current.eventType}
          options={EVENT_TYPE_OPTIONS.map((t) => ({
            value: t,
            label: EVENT_TYPE_LABEL[t] ?? t,
          }))}
          onChange={(v) => nav({ eventType: v as EventType | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Severidad">
        <SelectField
          label="Severidad"
          value={current.eventSeverity}
          options={SEVERITY_OPTIONS.map((s) => ({
            value: s,
            label: SEVERITY_LABEL[s] ?? s,
          }))}
          onChange={(v) => nav({ eventSeverity: v as Severity | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      {hasActiveAssetEventsFilters(current) && (
        <Link
          href={buildAssetEventsHref(assetId, current, {
            eventType: null,
            eventSeverity: null,
          })}
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
