"use client";

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import styles from "./AssetCombobox.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetCombobox · search-as-you-type asset picker
//  ─────────────────────────────────────────────────────────────
//  Replaces the native <select> when there are too many options
//  to scroll through (e.g. 80+ vehicles in Históricos). Searches
//  by name, plate, make, and model. Keyboard navigable:
//
//    · ArrowDown / ArrowUp  · move highlight
//    · Enter                · select highlighted
//    · Escape               · close popover
//    · Backspace on empty   · clear selection
//
//  Stateless re: URL — parent owns selectedId and onChange. The
//  combobox just renders + emits.
// ═══════════════════════════════════════════════════════════════

export interface AssetOption {
  id: string;
  name: string;
  plate: string | null;
  make: string | null;
  model: string | null;
}

interface AssetComboboxProps {
  options: AssetOption[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  placeholder?: string;
}

export function AssetCombobox({
  options,
  selectedId,
  onChange,
  label = "Asset",
  placeholder = "Seleccionar…",
}: AssetComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  // ── Selected option (for the closed-state display) ─────────
  const selected = useMemo(
    () => options.find((o) => o.id === selectedId) ?? null,
    [options, selectedId],
  );

  // ── Filtered options ───────────────────────────────────────
  // Tokenize query and require ALL tokens to match SOMEWHERE in
  // the asset's searchable text (name + plate + make + model).
  // This handles "iveco 1609" → matches "Camión 1609 · Iveco · …"
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const tokens = q.split(/\s+/);
    return options.filter((o) => {
      const haystack = [o.name, o.plate, o.make, o.model]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [options, query]);

  // ── Click outside to close ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ── Reset highlight when filter changes ────────────────────
  useEffect(() => {
    setHighlight(0);
  }, [query, filtered.length]);

  // ── Focus input when opening ───────────────────────────────
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleOpen() {
    setOpen(true);
    setQuery("");
  }

  function handleSelect(opt: AssetOption) {
    onChange(opt.id);
    setOpen(false);
    setQuery("");
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
    setQuery("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) handleSelect(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected) {
      handleClear();
    }
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {/* ── Trigger (closed state) ────────────────────────────── */}
      {!open && (
        <button
          type="button"
          className={`${styles.trigger} ${
            selected ? styles.triggerActive : ""
          }`}
          onClick={handleOpen}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>
            {selected ? (
              <>
                {selected.name}
                {selected.plate ? ` · ${selected.plate}` : ""}
              </>
            ) : (
              <span className={styles.placeholder}>{placeholder}</span>
            )}
          </span>
          {selected ? (
            <span
              role="button"
              aria-label="Limpiar"
              tabIndex={0}
              className={styles.clearBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              <X size={11} />
            </span>
          ) : (
            <ChevronDown size={12} className={styles.chev} />
          )}
        </button>
      )}

      {/* ── Open state · search input + listbox ───────────────── */}
      {open && (
        <div className={styles.popover}>
          <div className={styles.searchRow}>
            <Search size={13} className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Buscar por nombre, patente, marca…"
              className={styles.searchInput}
              aria-controls={listboxId}
              aria-autocomplete="list"
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            className={styles.list}
          >
            {filtered.length === 0 ? (
              <li className={styles.empty}>Sin resultados</li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={opt.id}
                  role="option"
                  aria-selected={opt.id === selectedId}
                  className={`${styles.item} ${
                    i === highlight ? styles.itemActive : ""
                  } ${opt.id === selectedId ? styles.itemSelected : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    // mousedown not click — beats the outside-click handler
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                >
                  <div className={styles.itemMain}>
                    <span className={styles.itemName}>{opt.name}</span>
                    {opt.plate && (
                      <span className={styles.itemPlate}>{opt.plate}</span>
                    )}
                  </div>
                  {(opt.make || opt.model) && (
                    <div className={styles.itemMeta}>
                      {[opt.make, opt.model].filter(Boolean).join(" ")}
                    </div>
                  )}
                  {opt.id === selectedId && (
                    <Check size={12} className={styles.itemCheck} />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
