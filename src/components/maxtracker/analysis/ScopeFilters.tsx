"use client";

import { useEffect, useState } from "react";
import { Layers, Truck, User, Search, X } from "lucide-react";
import type { ScopeFilters as Scope } from "@/lib/queries/analysis";
import { MultiSelect } from "./MultiSelect";
import styles from "./ScopeFilters.module.css";

interface Props {
  scope: Scope;
  available: {
    groups: { id: string; name: string }[];
    vehicleTypes: { value: string; label: string }[];
    drivers: { id: string; name: string }[];
  };
  rowCount: number;
  onChange: (next: Scope) => void;
}

export function ScopeFilters({ scope, available, rowCount, onChange }: Props) {
  const [searchDraft, setSearchDraft] = useState(scope.search ?? "");

  useEffect(() => {
    setSearchDraft(scope.search ?? "");
  }, [scope.search]);

  function commitSearch() {
    onChange({ ...scope, search: searchDraft.trim() || undefined });
  }

  const hasFilters =
    (scope.groupIds?.length ?? 0) > 0 ||
    (scope.vehicleTypes?.length ?? 0) > 0 ||
    (scope.personIds?.length ?? 0) > 0 ||
    !!scope.search;

  return (
    <div className={styles.wrap}>
      <MultiSelect
        label="Grupos"
        icon={<Layers size={12} />}
        options={available.groups.map((g) => ({ value: g.id, label: g.name }))}
        value={scope.groupIds ?? []}
        onChange={(v) =>
          onChange({ ...scope, groupIds: v.length > 0 ? v : undefined })
        }
        emptyLabel="Todos"
        searchPlaceholder="Buscar grupo…"
      />

      <MultiSelect
        label="Tipo"
        icon={<Truck size={12} />}
        options={available.vehicleTypes}
        value={scope.vehicleTypes ?? []}
        onChange={(v) =>
          onChange({ ...scope, vehicleTypes: v.length > 0 ? v : undefined })
        }
        emptyLabel="Todos"
        searchPlaceholder="Buscar tipo…"
        menuWidth={220}
      />

      <MultiSelect
        label="Choferes"
        icon={<User size={12} />}
        options={available.drivers.map((d) => ({ value: d.id, label: d.name }))}
        value={scope.personIds ?? []}
        onChange={(v) =>
          onChange({ ...scope, personIds: v.length > 0 ? v : undefined })
        }
        emptyLabel="Todos"
        searchPlaceholder="Buscar conductor…"
        menuWidth={300}
      />

      <div className={styles.searchWrap}>
        <Search size={12} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar vehículo o patente…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSearch();
            if (e.key === "Escape") {
              setSearchDraft("");
              onChange({ ...scope, search: undefined });
            }
          }}
          onBlur={commitSearch}
        />
        {searchDraft && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => {
              setSearchDraft("");
              onChange({ ...scope, search: undefined });
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      <div className={styles.spacer} />

      <span className={styles.rowCount}>
        Mostrando <strong>{rowCount}</strong>{" "}
        {rowCount === 1 ? "vehículo" : "vehículos"}
      </span>

      {hasFilters && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => onChange({})}
        >
          <X size={11} /> Limpiar filtros
        </button>
      )}
    </div>
  );
}
