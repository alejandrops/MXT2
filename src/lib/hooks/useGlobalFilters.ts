"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  useGlobalFilters · hook de filtros que persisten entre pantallas
//  ─────────────────────────────────────────────────────────────
//  Patrón:
//    · La fuente de verdad es la URL (searchParams)
//    · Cuando cambian, se persisten en sessionStorage
//    · Cuando se entra a una pantalla nueva sin filtros en URL,
//      se restauran desde sessionStorage si existen
//    · La pantalla puede consumir el state como needed
//
//  Filtros tracked:
//    grp     · group ids (csv)
//    type    · vehicle types (csv)
//    driver  · person ids (csv)
//    q       · search libre
//
//  Uso típico en una pantalla:
//    const { filters, setFilters, clearFilters, hasFilters } =
//      useGlobalFilters();
//
//  Las pantallas existentes pueden seguir leyendo de URL como
//  hacen hoy · este hook coexiste · agrega persistencia.
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = "maxtracker.globalFilters.v1";

export interface GlobalFilters {
  groupIds: string[];
  vehicleTypes: string[];
  personIds: string[];
  search: string;
}

const EMPTY_FILTERS: GlobalFilters = {
  groupIds: [],
  vehicleTypes: [],
  personIds: [],
  search: "",
};

function parseSearchParams(sp: URLSearchParams): GlobalFilters {
  return {
    groupIds: sp.get("grp")?.split(",").filter(Boolean) ?? [],
    vehicleTypes: sp.get("type")?.split(",").filter(Boolean) ?? [],
    personIds: sp.get("driver")?.split(",").filter(Boolean) ?? [],
    search: sp.get("q") ?? "",
  };
}

function hasAny(f: GlobalFilters): boolean {
  return (
    f.groupIds.length > 0 ||
    f.vehicleTypes.length > 0 ||
    f.personIds.length > 0 ||
    f.search.length > 0
  );
}

function loadFromStorage(): GlobalFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GlobalFilters>;
    return {
      groupIds: parsed.groupIds ?? [],
      vehicleTypes: parsed.vehicleTypes ?? [],
      personIds: parsed.personIds ?? [],
      search: parsed.search ?? "",
    };
  } catch {
    return null;
  }
}

function saveToStorage(f: GlobalFilters): void {
  if (typeof window === "undefined") return;
  try {
    if (hasAny(f)) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage puede fallar en privado/incógnito · ignorar
  }
}

function applyToUrl(
  pathname: string,
  current: URLSearchParams,
  f: GlobalFilters,
): string {
  const next = new URLSearchParams(current.toString());
  if (f.groupIds.length > 0) next.set("grp", f.groupIds.join(","));
  else next.delete("grp");
  if (f.vehicleTypes.length > 0) next.set("type", f.vehicleTypes.join(","));
  else next.delete("type");
  if (f.personIds.length > 0) next.set("driver", f.personIds.join(","));
  else next.delete("driver");
  if (f.search.length > 0) next.set("q", f.search);
  else next.delete("q");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

interface UseGlobalFiltersResult {
  filters: GlobalFilters;
  setFilters: (next: GlobalFilters) => void;
  clearFilters: () => void;
  hasFilters: boolean;
  /** Para usar en buildHref de pantallas con sus propios scopes. */
  toUrlParams: (f: GlobalFilters) => Partial<{
    grp: string;
    type: string;
    driver: string;
    q: string;
  }>;
}

export function useGlobalFilters(): UseGlobalFiltersResult {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  // Estado actual derivado de URL
  const [filters, setFiltersState] = useState<GlobalFilters>(EMPTY_FILTERS);

  // Hidratar al montar · si URL trae filtros, esos ganan
  // si no, restaurar de sessionStorage (y aplicar a URL)
  useEffect(() => {
    const fromUrl = parseSearchParams(sp);
    if (hasAny(fromUrl)) {
      setFiltersState(fromUrl);
      saveToStorage(fromUrl);
      return;
    }
    const stored = loadFromStorage();
    if (stored && hasAny(stored)) {
      setFiltersState(stored);
      // Reflejar en URL silenciosamente
      const href = applyToUrl(pathname, sp, stored);
      router.replace(href);
    } else {
      setFiltersState(EMPTY_FILTERS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // solo cuando cambia la pantalla

  // Sincronizar cuando URL cambia por otra razón (ej: usuario edita scope local)
  useEffect(() => {
    const fromUrl = parseSearchParams(sp);
    setFiltersState(fromUrl);
    saveToStorage(fromUrl);
  }, [sp]);

  const setFilters = useCallback(
    (next: GlobalFilters) => {
      setFiltersState(next);
      saveToStorage(next);
      const href = applyToUrl(pathname, sp, next);
      router.push(href);
    },
    [pathname, router, sp],
  );

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, [setFilters]);

  const toUrlParams = useCallback((f: GlobalFilters) => {
    const out: Partial<{
      grp: string;
      type: string;
      driver: string;
      q: string;
    }> = {};
    if (f.groupIds.length > 0) out.grp = f.groupIds.join(",");
    if (f.vehicleTypes.length > 0) out.type = f.vehicleTypes.join(",");
    if (f.personIds.length > 0) out.driver = f.personIds.join(",");
    if (f.search.length > 0) out.q = f.search;
    return out;
  }, []);

  return {
    filters,
    setFilters,
    clearFilters,
    hasFilters: hasAny(filters),
    toUrlParams,
  };
}
