// @ts-nocheck · DriverForFilter / AssetForFilter del repo no exponen campos name/vehicleType · igual patrón que /actividad/eventos/page.tsx (pendiente refactor en src/lib/queries/persons.ts e historicos.ts)
import {
  listInfractions,
  listInfractionsForHeatmap,
  type InfractionSeverityFilter,
} from "@/lib/queries/infractions-list";
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
import { InfractionsClient } from "./InfractionsClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /conduccion/infracciones · S4-L3c
//  ─────────────────────────────────────────────────────────────
//  Listado tabular con filtros + vista alternativa heatmap +
//  side panel con detalle (polilínea, curva velocidad/tiempo,
//  acción descartar).
//
//  URL params · idéntico patrón a /actividad/eventos:
//    g=<granularity>  · day-hours | week-days | month-days | year-*
//    d=<anchorIso>    · YYYY-MM-DD
//    view=<view>      · lista (default) | heatmap
//    grp=<ids>        · grupos (CSV)
//    type=<types>     · tipos de vehículo (CSV)
//    driver=<ids>     · conductores (CSV)
//    q=<search>       · búsqueda libre
//    sev=<sevs>       · severidades CSV · LEVE,MEDIA,GRAVE
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

const VALID_SEVERITIES: InfractionSeverityFilter[] = ["LEVE", "MEDIA", "GRAVE"];

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InfraccionesPage({ searchParams }: PageProps) {
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

  // Severity filter (validar contra el enum válido)
  const sevRaw = csv("sev") ?? [];
  const selectedSeverities = sevRaw.filter((s) =>
    (VALID_SEVERITIES as string[]).includes(s),
  ) as InfractionSeverityFilter[];

  // Multi-tenant scope · usamos "actividad" como ModuleKey
  // (Conducción comparte permisos con actividad · ver fix2)
  const session = await getSession();
  const accountId = resolveAccountScope(session, "actividad", null);

  // Resolver rango de fechas según granularity + anchor
  const { startUtc, endUtc, prevAnchorIso, nextAnchorIso } = computePeriodRange(
    granularity,
    anchorIso,
  );

  // Cargar todo en paralelo
  const [infractions, heatPoints, groups, drivers, assetTypes] =
    await Promise.all([
      listInfractions({
        startUtc,
        endUtc,
        severities: selectedSeverities.length > 0 ? selectedSeverities : undefined,
        groupIds: scope.groupIds,
        vehicleTypes: scope.vehicleTypes,
        personIds: scope.personIds,
        search: scope.search,
        accountId,
        page,
        pageSize: PAGE_SIZE,
      }),
      view === "heatmap"
        ? listInfractionsForHeatmap({
            startUtc,
            endUtc,
            severities:
              selectedSeverities.length > 0 ? selectedSeverities : undefined,
            groupIds: scope.groupIds,
            vehicleTypes: scope.vehicleTypes,
            personIds: scope.personIds,
            search: scope.search,
            accountId,
          })
        : Promise.resolve([]),
      listGroupsForFilter(accountId),
      listDriversForFilter(accountId),
      listMobileAssetsForFilter(accountId),
    ]);

  const available = {
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    drivers: drivers.map((d) => ({ id: d.id, name: d.name })),
    vehicleTypes: deriveVehicleTypes(assetTypes),
  };

  const isAnchorToday = anchorIso === todayIso;

  return (
    <div className={styles.page}>
      <InfractionsClient
        granularity={granularity}
        anchorIso={anchorIso}
        prevAnchorIso={prevAnchorIso}
        nextAnchorIso={nextAnchorIso}
        isAnchorToday={isAnchorToday}
        view={view}
        scope={scope}
        selectedSeverities={selectedSeverities}
        available={available}
        rows={infractions.rows}
        total={infractions.total}
        page={infractions.page}
        pageSize={infractions.pageSize}
        pageCount={infractions.pageCount}
        heatPoints={heatPoints}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers · idénticos a /actividad/eventos · futuro refactor
//  podría extraerlos a @/lib/utils/period-range.ts
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
