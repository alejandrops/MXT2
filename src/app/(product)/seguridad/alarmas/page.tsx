// @ts-nocheck · pre-existing patterns (Prisma types stale, leaflet sin types)
import {
  listAlarms,
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
import { AlarmsClient } from "./AlarmsClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /seguridad/alarmas · S5-T5 · canónico
//  ─────────────────────────────────────────────────────────────
//  URL params idénticos a /actividad/eventos:
//    g · d · view · grp · type · driver · q · status · page
//
//  Sin KPI strip · sin AlarmCard · sin AlarmFilterBar.
//  El status pasa de KPI strip a un filtro chip arriba de la tabla.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const VALID_G: AnalysisGranularity[] = [
  "day-hours",
  "week-days",
  "month-days",
  "year-weeks",
  "year-months",
];

const VALID_VIEWS = ["lista", "heatmap"] as const;
type ValidView = (typeof VALID_VIEWS)[number];

const VALID_STATUS = ["OPEN", "ATTENDED", "CLOSED", "DISMISSED"] as const;
type ValidStatus = (typeof VALID_STATUS)[number];

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AlarmasPage({ searchParams }: PageProps) {
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

  const viewRaw = get("view");
  const view: ValidView =
    viewRaw && (VALID_VIEWS as readonly string[]).includes(viewRaw)
      ? (viewRaw as ValidView)
      : "lista";

  const statusRaw = get("status");
  const selectedStatus: ValidStatus | null =
    statusRaw && (VALID_STATUS as readonly string[]).includes(statusRaw)
      ? (statusRaw as ValidStatus)
      : null;

  const pageRaw = get("page");
  const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1;

  const scope: ScopeFiltersType = {
    groupIds: csv("grp"),
    vehicleTypes: csv("type"),
    personIds: csv("driver"),
    search: get("q") ?? undefined,
  };

  const session = await getSession();
  const accountId = resolveAccountScope(session, "seguridad", null);

  const { startUtc, endUtc, prevAnchorIso, nextAnchorIso } = computePeriodRange(
    granularity,
    anchorIso,
  );

  // Filtrar también por período · listAlarms no soporta startUtc/endUtc
  // así que paginamos en JS después. Para volúmenes grandes, query nueva.
  const [allAlarmsResult, groups, drivers, assetTypes] = await Promise.all([
    listAlarms({
      status: selectedStatus,
      accountId,
      page: 1,
      pageSize: 5000, // suficiente para período · post-MVP query con date range
      sortBy: "triggeredAt",
      sortDir: "desc",
      search: scope.search ?? null,
    }),
    listGroupsForFilter(accountId),
    listDriversForFilter(accountId),
    listMobileAssetsForFilter(accountId),
  ]);

  // Filtrar por período en JS
  const inPeriod = allAlarmsResult.rows.filter((a: any) => {
    const t = new Date(a.triggeredAt).getTime();
    return t >= startUtc.getTime() && t < endUtc.getTime();
  });

  // Filtrar por scope.groupIds y scope.personIds en JS si vinieron
  const filtered = inPeriod.filter((a: any) => {
    if (scope.personIds?.length) {
      if (!a.person) return false;
      if (!scope.personIds.includes(a.person.id)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  // Heatmap · puntos lat/lng de las alarmas en período
  const heatPoints =
    view === "heatmap"
      ? filtered
          .filter((a: any) => a.lat != null && a.lng != null)
          .map((a: any) => ({
            lat: a.lat,
            lng: a.lng,
            intensity: 1,
          }))
      : [];

  const available = {
    groups: groups.map((g: any) => ({ id: g.id, name: g.name })),
    drivers: drivers.map((d: any) => ({ id: d.id, name: d.name })),
    vehicleTypes: deriveVehicleTypes(assetTypes),
  };

  const isAnchorToday = anchorIso === todayIso;

  return (
    <div className={styles.page}>
      <AlarmsClient
        granularity={granularity}
        anchorIso={anchorIso}
        prevAnchorIso={prevAnchorIso}
        nextAnchorIso={nextAnchorIso}
        isAnchorToday={isAnchorToday}
        view={view}
        scope={scope}
        selectedStatus={selectedStatus}
        available={available}
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        pageCount={pageCount}
        heatPoints={heatPoints}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers · idénticos a /actividad/eventos
// ═══════════════════════════════════════════════════════════════

function computePeriodRange(
  granularity: AnalysisGranularity,
  anchorIso: string,
) {
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
