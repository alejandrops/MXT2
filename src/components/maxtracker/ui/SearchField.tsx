"use client";

import { Search, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import styles from "./SearchField.module.css";

// ═══════════════════════════════════════════════════════════════
//  SearchField · L3-style-2 · search input reusable
//  ─────────────────────────────────────────────────────────────
//  Input de búsqueda con commit on Enter o blur (no en cada
//  keystroke · evita thrashear la URL).
//
//  Uso típico dentro de un <FilterFieldGroup label="Búsqueda">.
//  El componente NO incluye el label · queda flat para integrarse.
// ═══════════════════════════════════════════════════════════════

interface Props {
  /** Valor actual (committed) · viene de URL params */
  value: string | null;
  onCommit: (next: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Width estimado · default "240px" */
  width?: string;
}

export function SearchField({
  value,
  onCommit,
  placeholder = "Buscar…",
  disabled = false,
  width = "240px",
}: Props) {
  const [draft, setDraft] = useState(value ?? "");

  // Sync external changes (back/forward navigation, etc.)
  if (value !== null && value !== draft && document.activeElement?.tagName !== "INPUT") {
    setDraft(value);
  }

  function commit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = draft.trim();
    onCommit(trimmed.length > 0 ? trimmed : null);
  }

  function clear() {
    setDraft("");
    onCommit(null);
  }

  return (
    <form
      onSubmit={commit}
      className={styles.form}
      style={{ width }}
      aria-disabled={disabled}
    >
      <Search size={13} className={styles.icon} aria-hidden="true" />
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        placeholder={placeholder}
        disabled={disabled}
        className={styles.input}
      />
      {draft.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className={styles.clearBtn}
          disabled={disabled}
          aria-label="Limpiar búsqueda"
        >
          <X size={11} />
        </button>
      )}
    </form>
  );
}
