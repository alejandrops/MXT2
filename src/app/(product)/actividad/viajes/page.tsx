// @ts-nocheck · pre-existing patterns (Prisma types stale, leaflet sin types)
import {
  listGroupsForFilter,
  listMobileAssetsForFilter,
  listDriversForFilter,
} from "@/lib/queries";
import { listTripsAndStopsByDay } from "@/lib/queries/trips-by-day";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import type {
  AnalysisGranularity,
  ScopeFilters as ScopeFiltersType,
} from "@/lib/queries";
import { TripsClient } from "./TripsClient";
import { PageHeader } from "@/components/maxtracker/ui";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /actividad/viajes · S5-T3 · canónico
//  ─────────────────────────────────────────────────────────────
//  URL params idénticos a /actividad/eventos:
//    g=<granularity>  · day-hours | week-days | month-days |
//                       year-weeks | year-months
//    d=<anchorIso>    · YYYY-MM-DD
//    view=<view>      · lista (default) | heatmap
//    grp=<ids>        · grupos (CSV)
//    type=<types>     · tipos de vehículo (CSV)
//    driver=<ids>     · conductores (CSV)
//    q=<search>       · búsqueda libre
//    page=<n>         · paginación lista
//
//  Sin KPIs, sin Excel button, sin cap pattern.
// ═══════════════════════════════════════════════════════════════

export const revalidate = 60;

const VALID_G: AnalysisGranularity[] = [
  "day-hours",
  "week-days",
  "month-days",
  "year-weeks",
  "year-months",
];

const VALID_VIEWS = ["lista", "heatmap"] as const;
type ValidView = (typeof VALID_VIEWS)[number];

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ViajesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const get = (k: string): string | null => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const csv = (k: string): string[] | undefined => {
    const v = get(k);
    if (!v) return undefined;
    return v.split(",").filter(Boolean);
  };

  // Granularity & anchor
  const gRaw = get("g");
  const granularity: AnalysisGranularity =
    gRaw && (VALID_G as string[]).includes(gRaw)
      ? (gRaw as AnalysisGranularity)
      : "month-days";

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(
    todayLocal.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const anchorIso = get("d") ?? todayIso;

  // View
  const viewRaw = get("view");
  const view: ValidView =
    viewRaw && (VALID_VIEWS as readonly string[]).includes(viewRaw)
      ? (viewRaw as ValidView)
      : "lista";

  // Page
  const pageRaw = get("page");
  const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1;

  // Scope filters
  const scope: ScopeFiltersType = {
    groupIds: csv("grp"),
    vehicleTypes: csv("type"),
    personIds: csv("driver"),
    search: get("q") ?? undefined,
  };

  // Multi-tenant scope
  const session = await getSession();
  const accountId = resolveAccountScope(session, "actividad", null);

  // Resolver rango de fechas según granularity + anchor
  const { startUtc, endUtc, prevAnchorIso, nextAnchorIso } = computePeriodRange(
    granularity,
    anchorIso,
  );

  const fromDate = startUtc.toISOString().slice(0, 10);
  const toDate = endUtc.toISOString().slice(0, 10);

  // Cargar todo en paralelo
  const [allDays, groups, drivers, assetTypes] = await Promise.all([
    listTripsAndStopsByDay({
      fromDate,
      toDate,
      assetIds: undefined,
      groupIds: scope.groupIds ?? [],
      personIds: scope.personIds ?? [],
      accountId,
    }),
    listGroupsForFilter(accountId),
    listDriversForFilter(accountId),
    listMobileAssetsForFilter(accountId),
  ]);

  const total = allDays.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Paginar en JS · listTripsAndStopsByDay no soporta page nativo
  const start = (page - 1) * PAGE_SIZE;
  const days = allDays.slice(start, start + PAGE_SIZE);

  // Heatmap · derivar puntos desde TODOS los items kind="trip"
  // (el inicio del trip es el punto que se grafica)
  const heatPoints =
    view === "heatmap"
      ? allDays.flatMap((d) =>
          d.items
            .filter((it) => it.kind === "trip")
            .map((it: any) => ({
              lat: it.startLat,
              lng: it.startLng,
              intensity: 1,
            })),
        )
      : [];

  const available = {
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    drivers: drivers.map((d) => ({ id: d.id, name: d.name })),
    vehicleTypes: deriveVehicleTypes(assetTypes),
  };

  const isAnchorToday = anchorIso === todayIso;

  return (
    <>
      <PageHeader variant="module" title="Viajes" />
      <div className={styles.page}>
        <TripsClient
          granularity={granularity}
          anchorIso={anchorIso}
          prevAnchorIso={prevAnchorIso}
          nextAnchorIso={nextAnchorIso}
          isAnchorToday={isAnchorToday}
          view={view}
          scope={scope}
          available={available}
          rows={days}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          pageCount={pageCount}
          heatPoints={heatPoints}
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers · idénticos a /actividad/eventos
// ═══════════════════════════════════════════════════════════════

function computePeriodRange(
  granularity: AnalysisGranularity,
  anchorIso: string,
): {
  startUtc: Date;
  endUtc: Date;
  prevAnchorIso: string;
  nextAnchorIso: string | null;
} {
  const anchor = new Date(anchorIso + "T12:00:00-03:00");
  let start: Date;
  let end: Date;
  let prevAnchor: Date;

  switch (granularity) {
    case "day-hours": {
      start = new Date(anchorIso + "T03:00:00.000Z");
      end = new Date(start.getTime() + 86400000 - 1);
      prevAnchor = new Date(anchor.getTime() - 86400000);
      break;
    }
    case "week-days": {
      const dow = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1;
      start = new Date(anchor.getTime() - dow * 86400000);
      start.setUTCHours(3, 0, 0, 0);
      end = new Date(start.getTime() + 7 * 86400000 - 1);
      prevAnchor = new Date(start.getTime() - 7 * 86400000);
      break;
    }
    case "month-days": {
      start = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 3),
      );
      end = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1, 3) - 1,
      );
      prevAnchor = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1, 12),
      );
      break;
    }
    case "year-weeks":
    case "year-months": {
      start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1, 3));
      end = new Date(Date.UTC(anchor.getUTCFullYear() + 1, 0, 1, 3) - 1);
      prevAnchor = new Date(Date.UTC(anchor.getUTCFullYear() - 1, 0, 1, 12));
      break;
    }
  }

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayMs = todayLocal.getTime();
  const nextStartMs = end.getTime() + 1;
  const nextAnchorIso =
    nextStartMs > todayMs
      ? null
      : new Date(nextStartMs + 12 * 3600000).toISOString().slice(0, 10);

  const prevAnchorIso = prevAnchor.toISOString().slice(0, 10);

  return { startUtc: start, endUtc: end, prevAnchorIso, nextAnchorIso };
}

function deriveVehicleTypes(
  assetTypes: { vehicleType: string }[],
): { value: string; label: string }[] {
  const uniqueTypes = Array.from(
    new Set(assetTypes.map((a) => a.vehicleType)),
  ).filter(Boolean);
  const labels: Record<string, string> = {
    MOTOCICLETA: "Motocicleta",
    LIVIANO: "Liviano",
    UTILITARIO: "Utilitario",
    PASAJEROS: "Pasajeros",
    CAMION_LIVIANO: "Camión liviano",
    CAMION_PESADO: "Camión pesado",
    SUSTANCIAS_PELIGROSAS: "Sust. peligrosas",
    MAQUINA_VIAL: "Máquina vial",
    ASSET_FIJO: "Asset fijo",
  };
  return uniqueTypes.map((t) => ({ value: t, label: labels[t] ?? t }));
}
