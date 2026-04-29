import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  defaultModule,
  isModuleApplicable,
  type ModuleKey,
  type ObjectType,
} from "@/lib/object-modules";
import type { AnalysisGranularity } from "@/lib/queries";
import { getAssetLiveStatus } from "@/lib/queries/asset-live-status";
import { getDriverProfile } from "@/lib/queries/driver-profile";
import { getGroupProfile } from "@/lib/queries/group-profile";
import { ObjectBook } from "@/components/maxtracker/objeto/ObjectBook";
import { LiveStatus } from "@/components/maxtracker/objeto/LiveStatus";
import { DriverProfile } from "@/components/maxtracker/objeto/DriverProfile";
import { GroupProfile } from "@/components/maxtracker/objeto/GroupProfile";
import type { ObjectStatus } from "@/components/maxtracker/ui";
import { ActivityBookTab } from "./modules/ActivityBookTab";
import { SecurityBookTab } from "./modules/SecurityBookTab";

// ═══════════════════════════════════════════════════════════════
//  /objeto/[tipo]/[id]
//  ─────────────────────────────────────────────────────────────
//  Ruta única para los 3 tipos de Object: vehiculo, conductor, grupo.
//
//  Esquema real usado:
//    Asset · name, plate, make, model, vehicleType, groupId, status
//    Person · firstName, lastName, document, licenseExpiresAt
//    Group · name, accountId
//    LivePosition · assetId, recordedAt, speedKmh, ignition
//    Event · type (enum), severity (enum), occurredAt, metadata (string JSON)
//    AssetDriverDay · day, distanceKm, activeMin, tripCount
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const VALID_TYPES: ObjectType[] = ["vehiculo", "conductor", "grupo"];
const VALID_MODULES: ModuleKey[] = [
  "actividad",
  "seguridad",
  "conduccion",
  "mantenimiento",
  "combustible",
  "logistica",
  "documentacion",
  "sostenibilidad",
];
const VALID_G: AnalysisGranularity[] = [
  "day-hours",
  "week-days",
  "month-days",
  "year-weeks",
  "year-months",
];

interface PageProps {
  params: Promise<{ tipo: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ObjectBookPage({
  params,
  searchParams,
}: PageProps) {
  const { tipo: tipoRaw, id } = await params;
  if (!(VALID_TYPES as string[]).includes(tipoRaw)) {
    notFound();
  }
  const type = tipoRaw as ObjectType;

  const sp = await searchParams;
  const get = (k: string): string | null => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "string" && v.length > 0 ? v : null;
  };

  const mRaw = get("m");
  const requestedModule =
    mRaw && (VALID_MODULES as string[]).includes(mRaw)
      ? (mRaw as ModuleKey)
      : null;
  const activeModule: ModuleKey =
    requestedModule && isModuleApplicable(type, requestedModule)
      ? requestedModule
      : defaultModule(type);

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

  const meta = await loadObjectMeta(type, id);
  if (!meta) {
    notFound();
  }

  // Live status · solo para vehículos · cargado en paralelo en lo posible.
  // Es la tira de información en tiempo real que vive entre el header y el
  // PeriodBar · banner de alarmas + estado actual + datos del vehículo.
  const [liveStatus, driverProfile, groupProfile] = await Promise.all([
    type === "vehiculo" ? getAssetLiveStatus(id) : Promise.resolve(null),
    type === "conductor" ? getDriverProfile(id) : Promise.resolve(null),
    type === "grupo" ? getGroupProfile(id) : Promise.resolve(null),
  ]);

  // Header slot · contenido fijo entre el header y el PeriodBar.
  // Cada tipo tiene su propio profile.
  let headerSlot: React.ReactNode = undefined;
  if (liveStatus) {
    headerSlot = (
      <LiveStatus
        data={liveStatus}
        alarmsHref={`/objeto/vehiculo/${id}?m=seguridad`}
      />
    );
  } else if (driverProfile) {
    headerSlot = <DriverProfile data={driverProfile} />;
  } else if (groupProfile) {
    headerSlot = <GroupProfile data={groupProfile} />;
  }

  const { prevAnchorIso, nextAnchorIso } = computePeriodNav(
    granularity,
    anchorIso,
  );
  const isAnchorToday = anchorIso === todayIso;

  return (
    <ObjectBook
      type={type}
      id={id}
      name={meta.name}
      subtitle={meta.subtitle}
      metadata={meta.metadata}
      status={meta.status}
      activeModule={activeModule}
      granularity={granularity}
      anchorIso={anchorIso}
      prevAnchorIso={prevAnchorIso}
      nextAnchorIso={nextAnchorIso}
      isAnchorToday={isAnchorToday}
      headerSlot={headerSlot}
    >
      {activeModule === "actividad" && (
        <ActivityBookTab
          type={type}
          id={id}
          granularity={granularity}
          anchorIso={anchorIso}
        />
      )}
      {activeModule === "seguridad" && (
        <SecurityBookTab
          type={type}
          id={id}
          granularity={granularity}
          anchorIso={anchorIso}
        />
      )}
    </ObjectBook>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Cargar metadata del objeto · usa nombres reales del schema
// ═══════════════════════════════════════════════════════════════

interface ObjectMeta {
  name: string;
  subtitle?: string;
  metadata?: string;
  status: ObjectStatus | null;
}

async function loadObjectMeta(
  type: ObjectType,
  id: string,
): Promise<ObjectMeta | null> {
  if (type === "vehiculo") {
    const asset = await db.asset.findUnique({
      where: { id },
      include: {
        group: { select: { name: true } },
        livePosition: true,
      },
    });
    if (!asset) return null;

    const subtitleParts: string[] = [];
    if (asset.make) subtitleParts.push(asset.make);
    if (asset.model) subtitleParts.push(asset.model);

    const metaParts: string[] = [];
    if (asset.plate) metaParts.push(`Patente ${asset.plate}`);
    if (asset.group?.name) metaParts.push(asset.group.name);
    if (asset.vehicleType && asset.vehicleType !== "GENERIC") {
      metaParts.push(humanizeVehicleType(asset.vehicleType));
    }

    const status = resolveAssetStatus(
      asset.status,
      asset.livePosition?.recordedAt ?? null,
      asset.livePosition?.ignition ?? null,
      asset.livePosition?.speedKmh ?? null,
    );

    return {
      name: asset.name,
      subtitle: subtitleParts.join(" "),
      metadata: metaParts.join(" · "),
      status,
    };
  }

  if (type === "conductor") {
    const person = await db.person.findUnique({
      where: { id },
    });
    if (!person) return null;

    const fullName = `${person.firstName} ${person.lastName}`.trim();
    const metaParts: string[] = [];
    if (person.document) metaParts.push(`Doc. ${person.document}`);
    if (person.licenseExpiresAt) {
      const exp = person.licenseExpiresAt;
      metaParts.push(
        `Licencia vence ${String(exp.getUTCDate()).padStart(2, "0")}/${String(exp.getUTCMonth() + 1).padStart(2, "0")}/${exp.getUTCFullYear()}`,
      );
    }

    return {
      name: fullName,
      metadata: metaParts.join(" · "),
      status: null,
    };
  }

  if (type === "grupo") {
    const group = await db.group.findUnique({
      where: { id },
    });
    if (!group) return null;

    const assetCount = await db.asset.count({
      where: { groupId: id },
    });

    return {
      name: group.name,
      metadata: `${assetCount} ${assetCount === 1 ? "vehículo" : "vehículos"}`,
      status: null,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Resolver status del asset · combina enum status + livePosition
// ═══════════════════════════════════════════════════════════════

function resolveAssetStatus(
  status: string,
  recordedAt: Date | null,
  ignition: boolean | null,
  speedKmh: number | null,
): ObjectStatus {
  // Si no hay livePosition · status del enum o unknown
  if (!recordedAt) {
    if (status === "MAINTENANCE") return "off";
    return "unknown";
  }

  const ageMin = (Date.now() - recordedAt.getTime()) / 1000 / 60;
  if (ageMin > 30) return "no-signal";

  if (ignition) {
    return (speedKmh ?? 0) > 5 ? "moving" : "stopped";
  }
  return "off";
}

function humanizeVehicleType(vt: string): string {
  const map: Record<string, string> = {
    CAR: "Auto",
    TRUCK: "Camión",
    VAN: "Utilitario",
    BUS: "Colectivo",
    MOTO: "Moto",
    MACHINE: "Maquinaria",
    GENERIC: "",
  };
  return map[vt] ?? vt;
}

// ═══════════════════════════════════════════════════════════════
//  Calcular prev/next anchor para PeriodNavigator
// ═══════════════════════════════════════════════════════════════

function computePeriodNav(
  granularity: AnalysisGranularity,
  anchorIso: string,
): { prevAnchorIso: string; nextAnchorIso: string } {
  const [y, m, d] = anchorIso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));

  const prev = new Date(date);
  const next = new Date(date);

  switch (granularity) {
    case "day-hours":
      prev.setUTCDate(date.getUTCDate() - 1);
      next.setUTCDate(date.getUTCDate() + 1);
      break;
    case "week-days":
      prev.setUTCDate(date.getUTCDate() - 7);
      next.setUTCDate(date.getUTCDate() + 7);
      break;
    case "month-days":
      prev.setUTCMonth(date.getUTCMonth() - 1);
      next.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case "year-weeks":
    case "year-months":
      prev.setUTCFullYear(date.getUTCFullYear() - 1);
      next.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
  }

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  return {
    prevAnchorIso: fmt(prev),
    nextAnchorIso: fmt(next),
  };
}
