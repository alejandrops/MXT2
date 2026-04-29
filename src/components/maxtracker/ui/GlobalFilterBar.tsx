"use client";

import { X } from "lucide-react";
import { useGlobalFilters } from "@/lib/hooks/useGlobalFilters";
import styles from "./GlobalFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  GlobalFilterBar · banda con pills de filtros activos
//  ─────────────────────────────────────────────────────────────
//  Se renderiza arriba del contenido del módulo solo cuando hay
//  filtros activos · si no, no aparece (no ocupa espacio).
//
//  Cada pill se puede sacar individual o todos a la vez con
//  "Limpiar todos".
//
//  Esta barra coexiste con los ScopeFilters propios de cada
//  pantalla · es solo el indicador visual + atajo para clear.
// ═══════════════════════════════════════════════════════════════

interface Props {
  /**
   * Diccionarios opcionales para mostrar nombres en lugar de IDs.
   * Si no se pasan, se muestra el ID crudo.
   */
  groupNames?: Record<string, string>;
  driverNames?: Record<string, string>;
  vehicleTypeLabels?: Record<string, string>;
}

export function GlobalFilterBar({
  groupNames,
  driverNames,
  vehicleTypeLabels,
}: Props = {}) {
  const { filters, setFilters, clearFilters, hasFilters } = useGlobalFilters();

  if (!hasFilters) return null;

  function removeGroup(id: string) {
    setFilters({
      ...filters,
      groupIds: filters.groupIds.filter((x) => x !== id),
    });
  }
  function removeType(t: string) {
    setFilters({
      ...filters,
      vehicleTypes: filters.vehicleTypes.filter((x) => x !== t),
    });
  }
  function removeDriver(id: string) {
    setFilters({
      ...filters,
      personIds: filters.personIds.filter((x) => x !== id),
    });
  }
  function removeSearch() {
    setFilters({ ...filters, search: "" });
  }

  return (
    <div className={styles.bar} aria-label="Filtros aplicados">
      <span className={styles.label}>Filtros aplicados:</span>

      {filters.groupIds.map((id) => (
        <Pill
          key={`g-${id}`}
          label="Grupo"
          value={groupNames?.[id] ?? id}
          onRemove={() => removeGroup(id)}
        />
      ))}

      {filters.vehicleTypes.map((t) => (
        <Pill
          key={`t-${t}`}
          label="Tipo"
          value={vehicleTypeLabels?.[t] ?? t}
          onRemove={() => removeType(t)}
        />
      ))}

      {filters.personIds.map((id) => (
        <Pill
          key={`d-${id}`}
          label="Conductor"
          value={driverNames?.[id] ?? id}
          onRemove={() => removeDriver(id)}
        />
      ))}

      {filters.search.length > 0 && (
        <Pill label="Búsqueda" value={filters.search} onRemove={removeSearch} />
      )}

      <button type="button" className={styles.clearAll} onClick={clearFilters}>
        Limpiar todos
      </button>
    </div>
  );
}

function Pill({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className={styles.pill}>
      <span className={styles.pillLabel}>{label}:</span>
      <span className={styles.pillValue}>{value}</span>
      <button
        type="button"
        className={styles.pillRemove}
        onClick={onRemove}
        aria-label={`Quitar filtro ${label}`}
      >
        <X size={11} />
      </button>
    </span>
  );
}
