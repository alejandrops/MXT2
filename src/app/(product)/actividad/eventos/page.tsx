// @ts-nocheck · pre-existing patterns (Prisma types stale, leaflet.heat sin types)
import type { EventType, Severity } from "@/types/domain";
import {
  listEvents,
  listEventsForHeatmap,
} from "@/lib/queries/events-list";
import {
  listGroupsForFilter,
  listMobileAssetsForFilter,
  listDriversForFilter,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import type {
  AnalysisGranularity,
  ScopeFilters as ScopeFiltersType,
} from "@/lib/queries";
import { EventsClient } from "./EventsClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /actividad/eventos · S4-L2 · listado de eventos
//  ─────────────────────────────────────────────────────────────
//  Listado tabular con filtros + vista alternativa heatmap.
//  Compatible con el patrón del resto de pantallas /actividad.
//
//  URL params:
//    g=<granularity>  · day-hours | week-days | month-days | year-*
//    d=<anchorIso>    · YYYY-MM-DD
//    view=<view>      · lista (default) | heatmap
//    grp=<ids>        · grupos (CSV)
//    type=<types>     · tipos de vehículo (CSV)
//    driver=<ids>     · conductores (CSV)
//    q=<search>       · búsqueda libre
//    ev=<types>       · tipos de evento (CSV)
//    sev=<sevs>       · severidades (CSV)
//    page=<n>         · paginación lista
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

export default async function EventosPage({ searchParams }: PageProps) {
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
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
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

  // Event-specific filters
  const selectedTypes = (csv("ev") ?? []) as EventType[];
  const selectedSeverities = (csv("sev") ?? []) as Severity[];

  // Multi-tenant scope
  const session = await getSession();
  const accountId = resolveAccountScope(session, "actividad", null);

  // Resolver rango de fechas según granularity + anchor
  const { startUtc, endUtc, prevAnchorIso, nextAnchorIso } = computePeriodRange(
    granularity,
    anchorIso,
  );

  // Cargar todo en paralelo
  const [events, heatPoints, groups, drivers, assetTypes] = await Promise.all([
    listEvents({
      startUtc,
      endUtc,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      severities:
        selectedSeverities.length > 0 ? selectedSeverities : undefined,
      assetIds: undefined, // viene del filter de groups o por separado · no expuesto en URL aún
      groupIds: scope.groupIds,
      personIds: scope.personIds,
      search: scope.search,
      accountId,
      page,
      pageSize: PAGE_SIZE,
    }),
    view === "heatmap"
      ? listEventsForHeatmap({
          startUtc,
          endUtc,
          types: selectedTypes.length > 0 ? selectedTypes : undefined,
          severities:
            selectedSeverities.length > 0 ? selectedSeverities : undefined,
          groupIds: scope.groupIds,
          personIds: scope.personIds,
          search: scope.search,
          accountId,
        })
      : Promise.resolve([]),
    listGroupsForFilter(accountId),
    listDriversForFilter(accountId),
    listMobileAssetsForFilter(accountId),
  ]);

  // Available · construir desde los queries de filtro
  const available = {
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    drivers: drivers.map((d) => ({ id: d.id, name: d.name })),
    vehicleTypes: deriveVehicleTypes(assetTypes),
  };

  const isAnchorToday = anchorIso === todayIso;

  return (
    <div className={styles.page}>
      <EventsClient
        granularity={granularity}
        anchorIso={anchorIso}
        prevAnchorIso={prevAnchorIso}
        nextAnchorIso={nextAnchorIso}
        isAnchorToday={isAnchorToday}
        view={view}
        scope={scope}
        selectedTypes={selectedTypes}
        selectedSeverities={selectedSeverities}
        available={available}
        rows={events.rows}
        total={events.total}
        page={events.page}
        pageSize={events.pageSize}
        pageCount={events.pageCount}
        heatPoints={heatPoints}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
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
    CAR: "Auto",
    TRUCK: "Camión",
    VAN: "Van",
    MOTORCYCLE: "Moto",
    BUS: "Colectivo",
    TRAILER: "Acoplado",
    EQUIPMENT: "Equipo",
  };
  return uniqueTypes.map((t) => ({ value: t, label: labels[t] ?? t }));
}
