import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  getAssetLiveStatus · datos de tiempo real para el Libro
//  ─────────────────────────────────────────────────────────────
//  Loader específico del componente <LiveStatus /> del Libro del
//  Objeto · solo trae lo que ese componente renderiza · evita
//  cargar todo el AssetDetail histórico.
//
//  Usado por · /objeto/vehiculo/<id> (Lote 2.1)
//
//  Schema usado:
//    Asset                       · name, plate, year, vin, group, account
//    LivePosition                · 1:1 con Asset · última posición
//    Device                      · trackers · primary
//    Alarm count                 · solo OPEN para banner
//
//  Cosas DERIVADAS (no en schema):
//    · commState · cuán fresca es la última posición
//    · msSinceLastSeen · ms desde el último ping
//
//  Nota sobre commState:
//    ONLINE  · ping en los últimos 5 minutos
//    RECENT  · ping en los últimos 30 minutos
//    STALE   · ping en las últimas 24 horas
//    NO_COMM · más de 24 horas o nunca
// ═══════════════════════════════════════════════════════════════

export interface AssetLiveStatusData {
  // Identidad básica · refrescada acá por si llega antes del header
  id: string;
  name: string;
  plate: string | null;
  year: number | null;
  vin: string | null;

  // Contexto comercial
  accountName: string;
  groupName: string | null;

  // Última posición · null si nunca reportó
  lastPosition: {
    recordedAt: Date;
    lat: number;
    lng: number;
    speedKmh: number;
    heading: number | null;
    ignition: boolean;
  } | null;

  // Estado de comunicación · derivado
  commState: "ONLINE" | "RECENT" | "STALE" | "NO_COMM";
  msSinceLastSeen: number;

  // Conteo de alarmas abiertas · para banner
  openAlarms: number;

  // Dispositivo principal · primero el isPrimary, fallback al primero
  primaryDevice: {
    vendor: string;
    model: string;
  } | null;
}

const ONLINE_MS = 5 * 60 * 1000;
const RECENT_MS = 30 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

export async function getAssetLiveStatus(
  assetId: string,
): Promise<AssetLiveStatusData | null> {
  const [asset, openAlarms] = await Promise.all([
    db.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        name: true,
        plate: true,
        year: true,
        vin: true,
        account: { select: { name: true } },
        group: { select: { name: true } },
        livePosition: {
          select: {
            recordedAt: true,
            lat: true,
            lng: true,
            speedKmh: true,
            heading: true,
            ignition: true,
          },
        },
        devices: {
          select: { vendor: true, model: true, isPrimary: true },
          orderBy: { isPrimary: "desc" },
        },
      },
    }),
    db.alarm.count({
      where: { assetId, status: "OPEN" },
    }),
  ]);

  if (!asset) return null;

  // Comm state derivado
  const now = Date.now();
  const lastSeenMs = asset.livePosition?.recordedAt.getTime() ?? null;
  const msSinceLastSeen =
    lastSeenMs !== null ? Math.max(0, now - lastSeenMs) : Number.MAX_SAFE_INTEGER;

  let commState: AssetLiveStatusData["commState"] = "NO_COMM";
  if (lastSeenMs !== null) {
    if (msSinceLastSeen < ONLINE_MS) commState = "ONLINE";
    else if (msSinceLastSeen < RECENT_MS) commState = "RECENT";
    else if (msSinceLastSeen < STALE_MS) commState = "STALE";
    else commState = "NO_COMM";
  }

  // Primary device · ya viene ordenado por isPrimary desc
  const primaryDevice = asset.devices[0]
    ? { vendor: asset.devices[0].vendor, model: asset.devices[0].model }
    : null;

  return {
    id: asset.id,
    name: asset.name,
    plate: asset.plate,
    year: asset.year,
    vin: asset.vin,
    accountName: asset.account.name,
    groupName: asset.group?.name ?? null,
    lastPosition: asset.livePosition
      ? {
          recordedAt: asset.livePosition.recordedAt,
          lat: asset.livePosition.lat,
          lng: asset.livePosition.lng,
          speedKmh: asset.livePosition.speedKmh,
          heading: asset.livePosition.heading,
          ignition: asset.livePosition.ignition,
        }
      : null,
    commState,
    msSinceLastSeen,
    openAlarms,
  };
}
