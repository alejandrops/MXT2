"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  buildDriversHref,
  type DriversSearchParams,
} from "@/lib/url-drivers";
import { FilterFieldGroup, SelectField, SearchField } from "./ui";
import styles from "./DriverFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverFilterBar · L3-style-2 · Alt 2
//
//   BÚSQUEDA       CUENTA         ESTADO
//   [____________] [...]          [Todos | Activos | Inactivos]
// ═══════════════════════════════════════════════════════════════

interface DriverFilterBarProps {
  current: DriversSearchParams;
  accounts: { id: string; name: string }[];
}

const STATUS_OPTIONS = [
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

export function DriverFilterBar({ current, accounts }: DriverFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function nav(override: Partial<DriversSearchParams>) {
    startTransition(() => router.push(buildDriversHref(current, override)));
  }

  const hasFilters =
    current.search !== null ||
    current.accountId !== null ||
    current.status !== null;

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Búsqueda">
        <SearchField
          value={current.search ?? null}
          onCommit={(v) => nav({ search: v })}
          placeholder="Nombre o documento…"
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
          options={STATUS_OPTIONS}
          onChange={(v) =>
            nav({ status: v as "active" | "inactive" | null })
          }
          variant="bare"
        />
      </FilterFieldGroup>

      {hasFilters && (
        <Link
          href="/gestion/conductores"
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
