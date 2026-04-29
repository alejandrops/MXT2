"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Truck, User, Layers, Compass, Clock, X } from "lucide-react";
import { searchScreens, type ScreenEntry } from "@/lib/cmdk-screens";
import { useRecentItems, type RecentItem } from "@/lib/hooks/useRecentItems";
import type {
  SearchResult,
  VehicleHit,
  DriverHit,
  GroupHit,
} from "@/app/api/search/route";
import styles from "./CommandPalette.module.css";

// ═══════════════════════════════════════════════════════════════
//  CommandPalette · modal Cmd+K · search global
//  ─────────────────────────────────────────────────────────────
//  Atajo · Cmd+K (Mac) · Ctrl+K (Win/Linux) · abre/cierra
//
//  Contenidos:
//    · Input de búsqueda con debounce 200ms
//    · Resultados agrupados:
//        · Recientes (cuando q vacío)
//        · Vehículos · Conductores · Grupos (por API)
//        · Pantallas (matching local)
//    · Navegación con teclado · ↑↓ ↵ esc
//    · Click en resultado abre la URL y guarda en recientes
//
//  El componente se renderiza siempre · el modal usa display:none
//  cuando está cerrado (no monta/desmonta · evita relog del input).
// ═══════════════════════════════════════════════════════════════

const DEBOUNCE_MS = 200;

interface FlatItem {
  key: string;
  primary: string;
  secondary?: string;
  kind: "vehicle" | "driver" | "group" | "screen" | "recent";
  href: string;
  group: string;
  recentKind?: RecentItem["kind"];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({
    vehicles: [],
    drivers: [],
    groups: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { items: recents, addRecent } = useRecentItems();

  // ── Atajo Cmd+K / Ctrl+K para abrir el palette ────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // ── Listener custom event · permite abrir el palette desde
  //    cualquier botón del shell sin acoplar refs ni context.
  //    Disparar con: window.dispatchEvent(new Event("open-command-palette"))
  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () =>
      window.removeEventListener("open-command-palette", handleOpenEvent);
  }, []);

  // ── Focus input cuando abre · resetear estado ─────────────
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setActiveIndex(0);
      // pequeño delay para que el modal esté visible antes de focus
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // ── Debounce del query ────────────────────────────────────
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // ── Fetch resultados desde la API ─────────────────────────
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults({ vehicles: [], drivers: [], groups: [] });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data: SearchResult) => {
        if (!cancelled) {
          setResults(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // ── Construir lista flat para navegación con teclado ──────
  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];

    if (debouncedQuery.length < 2) {
      // Estado vacío · mostrar recientes
      for (const r of recents) {
        items.push({
          key: r.key,
          primary: r.primary,
          secondary: r.secondary,
          kind: "recent",
          recentKind: r.kind,
          href: r.href,
          group: "Recientes",
        });
      }
      return items;
    }

    for (const v of results.vehicles) {
      const sec = [v.make, v.model].filter(Boolean).join(" ");
      const tail = v.plate ? `· ${v.plate}` : "";
      items.push({
        key: `v-${v.id}`,
        primary: v.name,
        secondary: [sec, tail, v.groupName].filter(Boolean).join(" "),
        kind: "vehicle",
        href: `/objeto/vehiculo/${v.id}`,
        group: "Vehículos",
      });
    }

    for (const d of results.drivers) {
      items.push({
        key: `d-${d.id}`,
        primary: d.fullName,
        secondary: d.document ? `Doc. ${d.document}` : undefined,
        kind: "driver",
        href: `/objeto/conductor/${d.id}`,
        group: "Conductores",
      });
    }

    for (const g of results.groups) {
      items.push({
        key: `g-${g.id}`,
        primary: g.name,
        secondary: `${g.assetCount} ${g.assetCount === 1 ? "vehículo" : "vehículos"}`,
        kind: "group",
        href: `/objeto/grupo/${g.id}`,
        group: "Grupos",
      });
    }

    const screens = searchScreens(debouncedQuery);
    for (const s of screens) {
      items.push({
        key: `s-${s.href}`,
        primary: s.label,
        secondary: s.module,
        kind: "screen",
        href: s.href,
        group: "Pantallas",
      });
    }

    return items;
  }, [debouncedQuery, results, recents]);

  // Agrupar para render
  const grouped = useMemo(() => {
    const map = new Map<string, FlatItem[]>();
    for (const item of flatItems) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return Array.from(map.entries());
  }, [flatItems]);

  // ── Reset activeIndex cuando cambian los resultados ───────
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, recents.length]);

  // ── Scroll al item activo ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmdk-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // ── Navegación con teclado ────────────────────────────────
  const handleNav = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (flatItems.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flatItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(
          (i) => (i - 1 + flatItems.length) % flatItems.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) handleSelect(item);
      }
    },
    [flatItems, activeIndex], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Manejar selección de un item ──────────────────────────
  const handleSelect = useCallback(
    (item: FlatItem) => {
      // Guardar en recientes (excepto los que ya son recientes)
      if (item.kind !== "recent") {
        addRecent({
          key: item.key,
          primary: item.primary,
          secondary: item.secondary,
          kind: item.kind === "screen" ? "screen" : item.kind,
          href: item.href,
        });
      }
      setOpen(false);
      router.push(item.href);
    },
    [addRecent, router],
  );

  // ── Click overlay cierra ──────────────────────────────────
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        setOpen(false);
      }
    },
    [],
  );

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-label="Buscar">
        {/* ── Input ──────────────────────────────────────── */}
        <div className={styles.inputBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Buscar vehículos, conductores, grupos, pantallas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleNav}
            spellCheck={false}
            autoComplete="off"
          />
          {query.length > 0 && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Limpiar"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Lista de resultados ───────────────────────── */}
        <div ref={listRef} className={styles.list}>
          {loading && flatItems.length === 0 && (
            <div className={styles.empty}>Buscando…</div>
          )}

          {!loading && flatItems.length === 0 && debouncedQuery.length < 2 && (
            <div className={styles.empty}>
              Escribí al menos 2 caracteres · o navegá tu historial reciente
            </div>
          )}

          {!loading &&
            flatItems.length === 0 &&
            debouncedQuery.length >= 2 && (
              <div className={styles.empty}>
                Sin resultados para "{debouncedQuery}"
              </div>
            )}

          {grouped.map(([groupName, groupItems]) => (
            <div key={groupName} className={styles.group}>
              <div className={styles.groupHeader}>
                {groupName} · {groupItems.length}
              </div>
              <ul className={styles.groupList}>
                {groupItems.map((item) => {
                  const flatIdx = flatItems.indexOf(item);
                  const isActive = flatIdx === activeIndex;
                  return (
                    <li
                      key={item.key}
                      data-cmdk-index={flatIdx}
                      className={`${styles.item} ${
                        isActive ? styles.itemActive : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      onClick={() => handleSelect(item)}
                    >
                      <KindIcon item={item} />
                      <span className={styles.itemPrimary}>
                        {item.primary}
                      </span>
                      {item.secondary && (
                        <span className={styles.itemSecondary}>
                          {item.secondary}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Footer con hints de teclado ───────────────── */}
        <div className={styles.footer}>
          <Hint kbd="↑↓">navegar</Hint>
          <Hint kbd="↵">abrir</Hint>
          <Hint kbd="esc">cerrar</Hint>
          <span className={styles.footerSpacer} />
          <span className={styles.footerHint}>⌘K · ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

function KindIcon({ item }: { item: FlatItem }) {
  const kind = item.kind === "recent" ? item.recentKind ?? "screen" : item.kind;
  if (kind === "vehicle") {
    return <Truck size={13} className={styles.itemIcon} />;
  }
  if (kind === "driver") {
    return <User size={13} className={styles.itemIcon} />;
  }
  if (kind === "group") {
    return <Layers size={13} className={styles.itemIcon} />;
  }
  if (item.kind === "recent") {
    return <Clock size={13} className={styles.itemIcon} />;
  }
  return <Compass size={13} className={styles.itemIcon} />;
}

function Hint({ kbd, children }: { kbd: string; children: ReactNode }) {
  return (
    <span className={styles.hint}>
      <kbd className={styles.kbd}>{kbd}</kbd>
      <span>{children}</span>
    </span>
  );
}
