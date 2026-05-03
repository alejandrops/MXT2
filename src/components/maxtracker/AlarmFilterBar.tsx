"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  buildAlarmsHref,
  hasActiveAlarmFilters,
  type AlarmsSearchParams,
} from "@/lib/url-alarms";
import {
  ALARM_STATUS_LABEL,
  ALARM_TYPE_LABEL,
  SEVERITY_LABEL,
} from "@/lib/format";
import type { AlarmStatus, AlarmType, Severity } from "@/types/domain";
import { FilterFieldGroup, SelectField, SearchField } from "./ui";
import styles from "./AlarmFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  AlarmFilterBar · L3-style-2 · Alt 2
//
//   BÚSQUEDA       CUENTA       ESTADO       SEVERIDAD     TIPO
//   [____________] [...]        [...]        [...]         [...]
// ═══════════════════════════════════════════════════════════════

interface AlarmFilterBarProps {
  current: AlarmsSearchParams;
  accounts: { id: string; name: string }[];
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

export function AlarmFilterBar({ current, accounts }: AlarmFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function nav(override: Partial<AlarmsSearchParams>) {
    startTransition(() => router.push(buildAlarmsHref(current, override)));
  }

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Búsqueda">
        <SearchField
          value={current.search ?? null}
          onCommit={(v) => nav({ search: v })}
          placeholder="Vehículo o patente…"
          width="240px"
        />
      </FilterFieldGroup>

      {accounts.length > 1 && (
        <FilterFieldGroup label="Cuenta">
          <SelectField
            label="Cuenta"
            value={current.accountId}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            onChange={(v) => nav({ accountId: v })}
            variant="bare"
          />
        </FilterFieldGroup>
      )}

      <FilterFieldGroup label="Estado">
        <SelectField
          label="Estado"
          value={current.status}
          options={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: ALARM_STATUS_LABEL[s] ?? s,
          }))}
          onChange={(v) => nav({ status: v as AlarmStatus | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Severidad">
        <SelectField
          label="Severidad"
          value={current.severity}
          options={SEVERITY_OPTIONS.map((s) => ({
            value: s,
            label: SEVERITY_LABEL[s] ?? s,
          }))}
          onChange={(v) => nav({ severity: v as Severity | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Tipo">
        <SelectField
          label="Tipo"
          value={current.type}
          options={TYPE_OPTIONS.map((t) => ({
            value: t,
            label: ALARM_TYPE_LABEL[t] ?? t,
          }))}
          onChange={(v) => nav({ type: v as AlarmType | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      {hasActiveAlarmFilters(current) && (
        <Link
          href="/seguridad/alarmas"
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
